package stages

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/catalog"
	"gitlab.com/labpraxis/praxis-crm-be/etl/internal/visitador"
)

// EtapaMedico carga src/medicos/medicos_carteras.csv.
//
// Va después de visitador porque medico.visitador_id referencia
// visitador(persona_id), y la columna "VISITADOR ASIGNADO" de la cartera
// solo se puede resolver contra los visitadores ya cargados. También
// necesita especialidad (NOT NULL) y ciudad, de ahí el orden completo:
// ciudad -> especialidad -> visitador -> medico.
func EtapaMedico(
	ctx context.Context,
	pool *pgxpool.Pool,
	path string,
	ciudades *catalog.Ciudades,
	especialidades *catalog.Especialidades,
	mapa *visitador.Mapa,
) (Resumen, error) {
	registros, err := leerCartera(path)
	if err != nil {
		return Resumen{}, err
	}
	log.Printf("[medico] cartera con %d filas", len(registros))

	if err := validarCatalogos("medico", registros, ciudades, especialidades, mapa); err != nil {
		return Resumen{}, err
	}

	// Los índices se cargan una sola vez: consultar por cada fila convertiría
	// la carga en un O(n²) sobre la tabla persona.
	existentes, err := indiceMedicos(ctx, pool)
	if err != nil {
		return Resumen{}, err
	}
	log.Printf("[medico] %d médicos ya en la base", len(existentes))

	resumen := Resumen{Etapa: "medico"}
	for i, rec := range registros {
		nombre, primer, segundo := partidoDivide(rec.columna("nombre completo"))
		estado, err := upsertMedico(ctx, pool, rec, nombre, primer, segundo,
			ciudades, especialidades, mapa, existentes)
		if err != nil {
			resumen.Errores++
			resumen.Detalle = append(resumen.Detalle,
				fmt.Sprintf("fila %d (%s): %v", i+2, rec.columna("nombre completo"), err))
			continue
		}
		switch estado {
		case "actualizado":
			resumen.Actualizados++
		default:
			resumen.Insertados++
		}
	}

	log.Printf("[medico] %s", resumen)
	return resumen, nil
}

// validarCatalogos corta la corrida si algún valor crudo de la cartera no
// se puede resolver contra los catálogos. Un médico sin especialidad es un
// dato perdido; un médico con la especialidad equivocada es peor.
func validarCatalogos(
	etapa string,
	registros []registroCartera,
	ciudades *catalog.Ciudades,
	especialidades *catalog.Especialidades,
	mapa *visitador.Mapa,
) error {
	var ciudadesRaw, especialidadesRaw, visitadoresRaw []string
	for _, rec := range registros {
		ciudadesRaw = append(ciudadesRaw, rec.columna("ciudad"))
		especialidadesRaw = append(especialidadesRaw, rec.columna("especialidad"))
		visitadoresRaw = append(visitadoresRaw, rec.columna("visitador asignado"))
	}

	if err := revisarAliasDevuelve(etapa, "CIUDAD", ciudades.SinAlias(ciudadesRaw)); err != nil {
		return err
	}
	if err := revisarAliasDevuelve(etapa, "ESPECIALIDAD", especialidades.SinAlias(especialidadesRaw)); err != nil {
		return err
	}
	return revisarAliasDevuelve(etapa, "VISITADOR ASIGNADO", mapa.SinAlias(visitadoresRaw))
}

// indiceMedicos mapea clave natural -> persona_id de los médicos que ya
// están en la base, para reconocerlos en una segunda corrida.
//
// La clave se guarda al insertar en notas->>'cartera_clave', así que la
// reconstrucción es exacta: no se puede recalcular solo con columnas porque
// mezcla la especialidad cruda de la cartera ("MEDICINA GENERAL") con el
// código canónico de la base ("MGE"), y esos dos strings no coinciden. Para
// los médicos creados fuera del ETL (que no tienen cartera_clave) se usa la
// clave derivada, que a estos médicos no les va a coincidir con ninguna
// fila de la cartera de todos modos.
func indiceMedicos(ctx context.Context, pool *pgxpool.Pool) (map[string]int, error) {
	rows, err := pool.Query(ctx,
		`SELECT p.id,
		        p.nombre,
		        COALESCE(p.primer_apellido, ''),
		        COALESCE(p.segundo_apellido, ''),
		        COALESCE(m.notas->>'medico_id', ''),
		        e.codigo,
		        COALESCE(m.direccion->>'direccion', ''),
		        COALESCE(m.notas->>'cartera_clave', '')
		 FROM persona p
		 JOIN medico m ON m.persona_id = p.id
		 JOIN especialidad e ON e.id = m.especialidad_id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	indice := make(map[string]int)
	for rows.Next() {
		var id int
		var nombre, primer, segundo, medicoID, espCodigo, institucion, clave string
		if err := rows.Scan(&id, &nombre, &primer, &segundo, &medicoID, &espCodigo, &institucion, &clave); err != nil {
			return nil, err
		}
		if clave == "" {
			clave = claveMedico(nombre, primer, segundo, medicoID, espCodigo, institucion)
		}
		indice[clave] = id
	}
	return indice, rows.Err()
}

// claveMedico arma la clave natural de un médico.
//
// El nombre solo NO alcanza: la cartera tiene 10 nombres repetidos y en
// varios casos son dos personas distintas. Las líneas 114 y 1080 de
// medicos_carteras.csv son las dos "DR. JOSE MARTIN DAZA", pero con
// visitador asignado distinto, especialidad distinta (NEU y NEUM) y MEDICO
// ID distinto (Do2814 y Do3407): son dos médicos que comparten nombre.
// Indexar solo por nombre los fusionaba en uno y perdía la fila.
//
// Por eso la clave combina lo que de verdad distingue a una persona:
//
//	MEDICO ID presente  -> nombre + MEDICO ID. En la cartera separa
//	                       correctamente los 10 nombres repetidos.
//	MEDICO ID vacío     -> nombre + especialidad + institución, porque sin
//	                       el identificador no hay nada más que comparar.
func claveMedico(nombre, primer, segundo, medicoID, espCodigo, institucion string) string {
	base := claveNombre(nombre, primer, segundo)
	if id := catalog.Normalize(medicoID); id != "" {
		return base + "|" + id
	}
	return base + "|" + catalog.Normalize(espCodigo) + "|" + catalog.Normalize(institucion)
}

// claveNombre arma la parte de nombre de la clave natural de una persona a
// partir de su nombre partido. Se comparan los tres campos juntos porque
// "SAN PEDRO" y "PEDRO SAN" no son la misma persona.
func claveNombre(nombre, primer, segundo string) string {
	return catalog.Normalize(strings.TrimSpace(nombre + " " + primer + " " + segundo))
}

// matriculaDe genera la matrícula sintética de un médico nuevo.
//
// La cartera no trae una matrícula usable: MEDICO ID tiene 755 vacíos de
// 1892 filas y sus 169 valores distintos están todos duplicados, y la
// columna N° tiene 405 vacíos y 284 duplicados. Como medico.matricula es
// NOT NULL UNIQUE, se genera a partir del id de la persona, que es la clave
// primaria y por lo tanto única por construcción. Al ser estable, una
// segunda corrida no renumera a los médicos que ya estaban.
func matriculaDe(personaID int) string {
	return fmt.Sprintf("M-%06d", personaID)
}

func upsertMedico(
	ctx context.Context,
	pool *pgxpool.Pool,
	rec registroCartera,
	nombre, primer, segundo string,
	ciudades *catalog.Ciudades,
	especialidades *catalog.Especialidades,
	mapa *visitador.Mapa,
	existentes map[string]int,
) (string, error) {
	// medico.especialidad_id es NOT NULL. Si el catálogo no reconoce el
	// valor se usa la especialidad "Sin especificar (revisar)" para que la
	// fila entre y quede visible; validarCatalogos ya impidió que llegue un
	// valor desconocido, así que esto es solo la red de seguridad.
	espID, ok := especialidades.IDByAlias(rec.columna("especialidad"))
	if !ok {
		espID, ok = especialidades.IDByCode(catalog.IDPendiente)
		if !ok {
			return "", fmt.Errorf("la especialidad %q no existe y tampoco el código de respaldo %s",
				rec.columna("especialidad"), catalog.IDPendiente)
		}
	}

	var visitadorID *int
	if id, ok := mapa.Resolver(rec.columna("visitador asignado")); ok {
		visitadorID = &id
	}

	ciudadID := idCiudad(rec, ciudades, mapa, visitadorID)
	sexo := rec.columna("sexo")
	if sexo == "" {
		sexo = valorPorDefectoSexo
	}

	clave := claveMedico(nombre, primer, segundo, rec.columna("medico id"),
		rec.columna("especialidad"), rec.columna("institucion"))
	if personaID, ok := existentes[clave]; ok {
		// Ya existía (corrida anterior o alta manual en la app): se
		// actualiza sin tocar la matrícula, que es UNIQUE y ya se usa.
		if err := actualizarMedico(ctx, pool, rec, personaID, espID, visitadorID, ciudadID, nombre, primer, segundo, sexo, clave); err != nil {
			return "", err
		}
		return "actualizado", nil
	}

	// Persona y médico van en la misma transacción: si el médico falla no
	// puede quedar una persona huérfana sin su fila en medico.
	tx, err := pool.Begin(ctx)
	if err != nil {
		return "", fmt.Errorf("iniciando transacción: %w", err)
	}
	defer tx.Rollback(ctx)

	var personaID int
	err = tx.QueryRow(ctx,
		`INSERT INTO persona (nombre, primer_apellido, segundo_apellido, sexo, telefono, ciudad_id)
		 VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6) RETURNING id`,
		nombre, primer, segundo, sexo, rec.columna("telefono"), ciudadID,
	).Scan(&personaID)
	if err != nil {
		return "", fmt.Errorf("insertando persona: %w", err)
	}

	// es_particular va en true para todos: en la cartera no hay forma de
	// distinguir un médico particular de uno de institución.
	//
	// codigo se deja NULL a propósito. La columna MEDICO ID de la cartera
	// tiene 1137 filas con valor pero solo 169 distintos, y medico.codigo
	// es UNIQUE: cargarla fallaría en el segundo duplicado. La matrícula
	// sintética es la que identifica al médico. El MEDICO ID original se
	// guarda en notas para poder reconstruir la clave natural en la
	// siguiente corrida.
	if _, err := tx.Exec(ctx,
		`INSERT INTO medico (persona_id, matricula, especialidad_id, visitador_id, es_particular, direccion, notas)
		 VALUES ($1, $2, $3, $4, true, $5, $6)`,
		personaID, matriculaDe(personaID), espID, visitadorID,
		jsonbTexto(rec.columna("institucion")),
		jsonbNotas(rec.columna("programacion"), rec.columna("medico id"), clave),
	); err != nil {
		return "", fmt.Errorf("insertando médico: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return "", fmt.Errorf("confirmando transacción: %w", err)
	}

	existentes[clave] = personaID
	return "insertado", nil
}

func actualizarMedico(
	ctx context.Context,
	pool *pgxpool.Pool,
	rec registroCartera,
	personaID, espID int,
	visitadorID, ciudadID *int,
	nombre, primer, segundo, sexo, clave string,
) error {
	// medico.matricula no se toca: es UNIQUE, ya la usa el registro, y
	// cambiarla rompería las referencias externas.
	//
	// direccion y notas se actualizan igual que en el insert: la clave
	// natural incluye institución y MEDICO ID, así que si la cartera los
	// corrigiera, la siguiente corrida debe quedarse con el valor nuevo.
	tag, err := pool.Exec(ctx,
		`UPDATE persona
		 SET nombre = $1, primer_apellido = $2, segundo_apellido = $3, sexo = $4,
		     telefono = COALESCE(NULLIF($5, ''), telefono), ciudad_id = $6
		 WHERE id = $7`,
		nombre, primer, segundo, sexo, rec.columna("telefono"), ciudadID, personaID)
	if err != nil {
		return fmt.Errorf("actualizando persona %d: %w", personaID, err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("la persona %d no existe", personaID)
	}

	if _, err := pool.Exec(ctx,
		`UPDATE medico
		 SET especialidad_id = $1,
		     visitador_id = COALESCE($2, visitador_id),
		     es_particular = true,
		     direccion = $3,
		     notas = $4,
		     status = true
		 WHERE persona_id = $5`,
		espID, visitadorID, jsonbTexto(rec.columna("institucion")),
		jsonbNotas(rec.columna("programacion"), rec.columna("medico id"), clave), personaID); err != nil {
		return fmt.Errorf("actualizando médico %d: %w", personaID, err)
	}
	return nil
}

// jsonbTexto envuelve un texto plano en un objeto JSONB válido. La columna
// direccion es JSONB: mandar texto crudo daría error de sintaxis.
func jsonbTexto(texto string) string {
	texto = strings.TrimSpace(texto)
	if texto == "" {
		return "{}"
	}
	// La dirección de la cartera es un solo texto; se guarda tal cual para
	// no inventar una estructura que la app no espera.
	return fmt.Sprintf(`{"direccion": %q}`, texto)
}

// jsonbNotas guarda la programación y el MEDICO ID original como nota
// estructurada. El MEDICO ID no se puede guardar en medico.codigo por su
// UNIQUE con valores repetidos, pero hace falta para reconstruir la clave
// natural en corridas siguientes.
func jsonbNotas(texto, medicoID, carteraClave string) string {
	notas := map[string]string{}
	if texto = strings.TrimSpace(texto); texto != "" {
		notas["programacion"] = texto
	}
	if medicoID = strings.TrimSpace(medicoID); medicoID != "" {
		notas["medico_id"] = medicoID
	}
	// La clave natural se guarda tal cual se calculó sobre la cartera: es
	// la única forma de que la siguiente corrida la reproduzca exacta
	// cuando la especialidad vino como alias ("MED GENERAL" => MGE).
	notas["cartera_clave"] = carteraClave
	if len(notas) == 0 {
		return "{}"
	}
	codificada, err := json.Marshal(notas)
	if err != nil {
		return "{}"
	}
	return string(codificada)
}
