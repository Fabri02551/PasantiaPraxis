import csv
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
SRC_DIR = BASE_DIR / "src"
MEDICOS_DIR = SRC_DIR / "medicos"
INSTITUCIONES_DIR = SRC_DIR / "instituciones"
MEDICOS_OUT = MEDICOS_DIR / "medicos_carteras.csv"
INSTITUCIONES_OUT = INSTITUCIONES_DIR / "instituciones_carteras.csv"
REVIEW_OUT = INSTITUCIONES_DIR / "revisar_clasificacion.csv"

FIELDS = [
    "VISITADOR ASIGNADO",
    "NOMBRE COMPLETO",
    "SEXO",
    "TIPO",
    "ESPECIALIDAD",
    "INSTITUCION",
    "CIUDAD",
    "TELEFONO",
    "EMAIL",
    "CATEGORIA",
    "PROGRAMACION",
    "MEDICO ID",
    "N°",
    "DUPLICADO",
    "ARCHIVO",
    "INST ID",
]

MEDICO_COLUMNS = [
    "VISITADOR ASIGNADO",
    "NOMBRE COMPLETO",
    "SEXO",
    "TIPO",
    "ESPECIALIDAD",
    "INSTITUCION",
    "CIUDAD",
    "TELEFONO",
    "EMAIL",
    "CATEGORIA",
    "PROGRAMACION",
    "MEDICO ID",
    "N°",
    "DUPLICADO",
    "ARCHIVO",
]

INSTITUCION_COLUMNS = [
    "VISITADOR ASIGNADO",
    "NOMBRE COMPLETO",
    "TIPO",
    "ESPECIALIDAD",
    "DIRECCION",
    "CIUDAD",
    "TELEFONO",
    "EMAIL",
    "CATEGORIA",
    "INST ID",
    "DUPLICADO",
    "ARCHIVO",
]

REVIEW_COLUMNS = [
    "VISITADOR ASIGNADO",
    "NOMBRE COMPLETO",
    "SITUACION",
    "ESPECIALIDAD",
    "INSTITUCION",
    "CIUDAD",
    "ARCHIVO",
]

VISITOR_ALIASES = {
    "ALEJANDRA": "ALEJANDRA PAREDES",
    "KEILA": "KEILA ESPINOZA",
    "JAHAZIEL": "JAHAZIEL FACIO",
    "MARAHI": "MARAHI HERRERA",
    "CONSUELO": "CONSUELO MUÑOZ",
    "KAREN": "KAREN CASTRO",
    "ROCIO": "ROCIO MIRANDA",
    "OCTAVIA": "OCTAVIA CRUZ",
}

VISITOR_DISPLAY = {
    "ALEJANDRA PAREDES": "ALEJANDRA PAREDES",
    "KEILA ESPINOZA": "KEILA ESPINOZA",
    "JAHAZIEL FACIO": "JAHAZIEL FACIO",
    "MARAHI HERRERA": "MARAHI HERRERA",
    "CONSUELO MUNOZ": "CONSUELO MUÑOZ",
    "KAREN CASTRO": "KAREN CASTRO",
    "ROCIO MIRANDA": "ROCIO MIRANDA",
    "OCTAVIA CRUZ": "OCTAVIA CRUZ",
}

ENTITY_SPECIALTIES = {
    "LAB",
    "LABORATORIO",
    "INSTITUCION",
    "CLINICA",
    "HOSPITAL",
    "VETERINARIA",
}

ENTITY_NAME_MARKERS = (
    "LAB ",
    "LAB.",
    "CLINICA",
    "HOSPITAL",
    "INSTITUTO",
    "FUNDACION",
    "CENTRO",
    "SOC.",
    "SOCIEDAD",
    "FARMACIA",
    "CAJA ",
    "UNIDAD",
    "SANITARY",
    "VETERIN",
    "VIDA SANA",
    "NACIONAL",
)

ENTITY_FIRST_TOKENS = {
    "LAB",
    "LABORATORIO",
    "LABORATORO",
    "LABORATOTIO",
    "CLINICA",
    "CLINICAS",
    "HOSPITAL",
    "HOSPITALES",
    "INSTITUTO",
    "FUNDACION",
    "FUNDACIONES",
    "CENTRO",
    "SOCIEDAD",
    "FARMACIA",
    "COOPERATIVA",
    "MUTUAL",
    "CAJA",
    "UNIDAD",
    "SERVICIO",
    "POSTA",
    "COLEGIO",
    "PENSION",
    "SAN",
    "SANTA",
    "SANTISIMA",
    "SANTISIMO",
    "VIRGEN",
    "VET",
    "BIO",
    "CS",
    "GERIATRICO",
    "IMAGEN",
    "RX",
    "ECO",
}

FEMININE_NAMES = set(
    """
    ABBA ADELA ADELAIDA ADRIANA AGUSTINA AIDA AIMEE ALBA ALEJANDRA
    ALESSANDRA ALEXANDRA ALFONSINA ALICIA AMALIA AMANDA AMARILLA AMELIA AMELIE ANA
    ANABEL ANDREA ANGELA ANGELICA ANGELINA ANITA ANNA ANNY ARIANA AURORA BEATRIZ
    BELEN BERNARDA BLANCA BRENDA BRIGIDA CARLA CARMEN CECILIA CELIA CELINA CELINE
    CLEMENTINA CONSTANZA CRYSTAL DAFNE DANAE DANIELA DEISY DELIA DIANA DOLORES EDITH
    ELISA ELENA ELIANA ELIANE ELIENE ELISA ELIZABETH ELISA EMILIA ERICA ESTELA EVA
    FATIMA FABIOLA FERNANDA FLORENCIA FRANCESCA GABRIELA GABRIELLA GENOVEVA GIANELLA
    GILDA GLADYS GLORIA GRACIELA GUISELA HEIDI HELEN HILDA ISABEL IVONNE JENIFER JENNY
    JIMENA JOHANA JOSELYN JUDITH JUANA KAREN KARLA KARINA LAURA LENY LETICIA LILIANA
    LILIAN LISET LIZETH LORENA LOURDES LUCIA LUCIANA MAGDALENA
    MARCELA MARIA MARIANELA MARIELA MARISELA MARISOL MARLENE MAYRA MELANIE MELISA
    MIREYA MONICA NANCY NATALIA NATALY NELLY NICOLE NOELIA NORMA OLGA PAMELA PAOLA PATRICIA
    PAULA PILAR RACHEL RAQUEL REINA ROCIO ROMINA ROSA ROSALIA SANDRA SARA SILVIA SOFIA
    SONIA SUSANA TANY TERESA VALERIA VERONICA VICTORIA VIOLETA VIVIAN WENDY XIMENA
    YENI YOLANDA ZAIDA ZULEMA
    """.split()
)

MASCULINE_NAMES = set(
    """
    AARON ABEL ADHEMAR ADOLFO ADRIAN ALAN ALBERTO ALDO ALEJANDRO ALEX ALFREDO ALONSO
    ALVARO ANDRES ANGEL ANTONIO ARMANDO ARON ARTURO BENJAMIN BERNARDO BRAYAN BRUNO CARLOS
    CESAR CRISTIAN CRISTHIAN DANIEL DARIO DAVID DENIS DENNIS DIEGO EDGAR EDINSON EDUARDO
    ELIAS ELMER EMANUEL EMMANUEL ENRIQUE ERICK ERIK ERNESTO ERWIN ESTEBAN FABIAN FELIX
    FERNANDO FRANCISCO FRANCO FRANZ GABRIEL GERARDO GONZALO GUIDO GUSTAVO HECTOR HENRY
    HERNAN HORACIO HUGO HUMBERTO IGOR IGNACIO IVAN JAIRO JAIME JAVIER JESUS JHO JOSE JORGE
    JUAN JOAQUIN JULIAN JULIO KEVIN LEONARDO LESTER LIMBER LORENZO LUIS MANUEL MARCEL
    MARCELO MARCO MARIO MARTIN MATEO MATHEUS MAURICIO MIGUEL MILTON NELSON NICOLAS OMAR
    ORLANDO PABLO PAUL PEDRO RAUL RENE RICARDO RICHARD ROBERTO RODRIGO ROLANDO RONALD
    RONNY RUBEN SAUL SALVADOR SAMUEL SANTIAGO SEBASTIAN SERGIO TITO VICTOR VICENTE VLADIMIR
    WALTER WILLY WILSON
    """.split()
)

TITLE_PATTERN = re.compile(r"\b(DRA|DR|LIC)\.?")


def clean(value):
    if value is None:
        return ""
    try:
        if pd.isna(value):
            return ""
    except (TypeError, ValueError):
        pass
    return str(value).strip()


def norm(value):
    value = clean(value).upper()
    value = " ".join(value.split())
    return "".join(
        char for char in unicodedata.normalize("NFD", value)
        if unicodedata.category(char) != "Mn"
    )


def norm_name(value):
    value = norm(value)
    prefixes = ("DRA. ", "DRA ", "DR. ", "DR ", "LIC. ", "LIC ")
    changed = True
    while changed:
        changed = False
        for prefix in prefixes:
            if value.startswith(prefix):
                value = value[len(prefix):].strip()
                changed = True
                break
    return value


def canonical_visitor(value):
    normalized = norm(value)
    canonical = VISITOR_ALIASES.get(normalized, normalized)
    return VISITOR_DISPLAY.get(canonical, clean(value).upper() or canonical)


def num(value):
    value = clean(value)
    if not value or value.upper() in {"#N/A", "#N/D", "N/A", "NA", "-"}:
        return ""
    try:
        number = float(value.replace(",", "."))
        if number.is_integer():
            return str(int(number))
    except (TypeError, ValueError):
        pass
    return value


def boolean_value(value):
    value = clean(value).upper()
    if value in {"TRUE", "1", "1.0", "SI", "SÍ", "YES"}:
        return "True"
    if value in {"FALSE", "0", "0.0", "NO", ""}:
        return "False" if value else ""
    return value


def record_key(record):
    return (
        canonical_visitor(record["VISITADOR ASIGNADO"]),
        norm_name(record["NOMBRE COMPLETO"]),
    )


def empty_record():
    return {field: "" for field in FIELDS}


def valid_row(visitor, name):
    visitor = canonical_visitor(visitor)
    name = clean(name)
    return bool(visitor and visitor != "*" and name)


def infer_tipo(name, specialty):
    name = norm(name)
    specialty = norm(specialty)
    if TITLE_PATTERN.search(name):
        return "MEDICO"
    if specialty in ENTITY_SPECIALTIES:
        return "ENTIDAD"
    if any(marker in name for marker in ENTITY_NAME_MARKERS):
        return "ENTIDAD"
    return "MEDICO"


def first_name(name):
    ignored = {
        "DR",
        "DRA",
        "LIC",
        "DE",
        "DEL",
        "LA",
        "LAS",
        "LOS",
        "Y",
        "E",
    }
    for token in re.split(r"\s+", norm(name)):
        token = token.strip(".,:;()[]")
        if not token or token in ignored:
            continue
        if re.fullmatch(r"[A-Z]", token) or re.fullmatch(r"[A-Z]\.[A-Z]", token):
            continue
        return token
    return ""


def has_doctor_title(name):
    return bool(TITLE_PATTERN.search(norm(name)))


def looks_like_entity(name):
    return first_name(name) in ENTITY_FIRST_TOKENS


def infer_sexo(names, existing_values=()):
    title_values = set()
    for name in names:
        for title in TITLE_PATTERN.findall(norm(name)):
            if title == "DRA":
                title_values.add("F")
            elif title == "DR":
                title_values.add("M")

    existing = {
        value.upper()
        for value in existing_values
        if clean(value).upper() in {"M", "F"}
    }

    if len(title_values) > 1:
        return ""
    if title_values and existing and title_values != existing:
        return ""
    if len(title_values) == 1:
        return next(iter(title_values))
    if len(existing) == 1:
        return next(iter(existing))

    name_values = set()
    for name in names:
        first = first_name(name)
        if first in FEMININE_NAMES and first not in MASCULINE_NAMES:
            name_values.add("F")
        elif first in MASCULINE_NAMES and first not in FEMININE_NAMES:
            name_values.add("M")
    if len(name_values) == 1:
        return next(iter(name_values))
    return ""


def valid_dataframe(frame):
    return "NOMBRE COMPLETO" in frame.columns and "VISITADOR ASIGNADO" in frame.columns


def row_record(visitor, name, specialty, location, city, phone, email, category,
               programming, medic_id, number, duplicate, file_name, institution_id="",
               tipo="", source_kind="regional"):
    record = empty_record()
    record.update({
        "VISITADOR ASIGNADO": canonical_visitor(visitor),
        "NOMBRE COMPLETO": clean(name),
        "TIPO": tipo,
        "ESPECIALIDAD": clean(specialty),
        "INSTITUCION": clean(location),
        "CIUDAD": clean(city),
        "TELEFONO": num(phone),
        "EMAIL": clean(email),
        "CATEGORIA": clean(category),
        "PROGRAMACION": clean(programming),
        "MEDICO ID": num(medic_id),
        "N°": num(number),
        "DUPLICADO": clean(duplicate),
        "ARCHIVO": file_name,
        "INST ID": num(institution_id),
    })
    record["_SOURCE_KIND"] = source_kind
    return record


def load_legacy(path):
    if not path.exists():
        return []

    try:
        with path.open(encoding="utf-8-sig", newline="") as handle:
            rows = list(csv.reader(handle, delimiter=";"))
    except (OSError, csv.Error):
        return []

    if len(rows) < 2:
        return []

    header = [clean(value) for value in rows[0]]
    required = {"VISITADOR ASIGNADO", "NOMBRE COMPLETO"}
    if not required.issubset(set(header)):
        return []

    indexes = {name: index for index, name in enumerate(header)}

    def cell(row, name):
        index = indexes.get(name)
        if index is None or index >= len(row):
            return ""
        return clean(row[index])

    result = []
    for row in rows[1:]:
        visitor = cell(row, "VISITADOR ASIGNADO")
        name = cell(row, "NOMBRE COMPLETO")
        if not valid_row(visitor, name):
            continue
        record = empty_record()
        record.update({
            "VISITADOR ASIGNADO": canonical_visitor(visitor),
            "NOMBRE COMPLETO": name,
            "SEXO": cell(row, "SEXO"),
            "TIPO": cell(row, "TIPO"),
            "ESPECIALIDAD": cell(row, "ESPECIALIDAD"),
            "INSTITUCION": cell(row, "INSTITUCION") or cell(row, "DIRECCION"),
            "CIUDAD": cell(row, "CIUDAD"),
            "TELEFONO": num(cell(row, "TELEFONO")),
            "EMAIL": cell(row, "EMAIL"),
            "CATEGORIA": cell(row, "CATEGORIA"),
            "PROGRAMACION": cell(row, "PROGRAMACION"),
            "MEDICO ID": num(cell(row, "MEDICO ID")),
            "N°": num(cell(row, "N°")),
            "DUPLICADO": cell(row, "DUPLICADO"),
            "ARCHIVO": cell(row, "ARCHIVO") or path.name,
            "INST ID": num(cell(row, "INST ID")),
        })
        record["_SOURCE_KIND"] = "legacy"
        result.append(record)
    return result


def load_kardex(path, source_kind="regional"):
    records = []
    try:
        workbook = pd.ExcelFile(path)
    except (OSError, ValueError):
        return records

    for sheet in workbook.sheet_names:
        try:
            frame = pd.read_excel(path, sheet_name=sheet)
        except (OSError, ValueError):
            continue
        if not valid_dataframe(frame):
            continue

        for _, row in frame.iterrows():
            visitor = row.get("VISITADOR ASIGNADO", "")
            name = row.get("NOMBRE COMPLETO", "")
            if not valid_row(visitor, name):
                continue

            if source_kind == "explicit" and path.name == "DATA.KARDEX.xlsx":
                if sheet == "C.INST":
                    tipo = "ENTIDAD"
                    location = row.get("DIRECCION", "")
                    institution_id = row.get("INST ID", "")
                    programming = ""
                    medic_id = ""
                    number = ""
                elif sheet == "C.MEDIC":
                    tipo = "MEDICO"
                    location = row.get("INSTITUCION", "")
                    institution_id = ""
                    programming = ""
                    medic_id = row.get("MEDICO ID", "")
                    number = ""
                else:
                    continue
            else:
                tipo = ""
                location = row.get("INSTITUCION", "")
                institution_id = ""
                programming = row.get("PROGRAMACION", "")
                medic_id = row.get("MEDICO ID", "")
                number = row.get("N°", "")

            records.append(row_record(
                visitor,
                name,
                row.get("ESPECIALIDAD", ""),
                location,
                row.get("CIUDAD", ""),
                row.get("TELEFONO", ""),
                row.get("EMAIL", ""),
                row.get("CATEGORIA", ""),
                programming,
                medic_id,
                number,
                row.get("DUPLICADO", ""),
                path.name,
                institution_id,
                tipo,
                source_kind,
            ))
    return records


def merge_values(records, field, separator="$"):
    values = []
    for record in records:
        value = clean(record.get(field, ""))
        if value and value not in values:
            values.append(value)
    return separator.join(values)


def choose_type(key, records, legacy_types, ambiguous, named_entities):
    explicit = Counter(
        record.get("TIPO", "")
        for record in records
        if record.get("_SOURCE_KIND") == "explicit" and record.get("TIPO") in {"MEDICO", "ENTIDAD"}
    )
    if explicit:
        return explicit.most_common(1)[0][0]

    hints = legacy_types.get(key, set())
    hint = next(iter(hints)) if len(hints) == 1 else ""

    titled = any(has_doctor_title(record.get("NOMBRE COMPLETO", "")) for record in records)
    entity_named = any(looks_like_entity(record.get("NOMBRE COMPLETO", "")) for record in records)

    if entity_named and not titled:
        named_entities.append(key)
        return "ENTIDAD"
    if titled and not entity_named:
        return "MEDICO"

    if hint:
        return hint

    inferred = Counter(
        infer_tipo(record.get("NOMBRE COMPLETO", ""), record.get("ESPECIALIDAD", ""))
        for record in records
        if record.get("TIPO", "") not in {"MEDICO", "ENTIDAD"}
    )
    if inferred:
        return inferred.most_common(1)[0][0]

    ambiguous.append(key)
    return "MEDICO"


def merge_group(key, records, tipo, ambiguous):
    merged = empty_record()
    names = [clean(record.get("NOMBRE COMPLETO", "")) for record in records]
    names = [name for name in names if name]
    existing_sexes = [record.get("SEXO", "") for record in records]

    merged["VISITADOR ASIGNADO"] = key[0]
    merged["NOMBRE COMPLETO"] = max(names, key=lambda value: (len(value), value), default="")
    merged["SEXO"] = infer_sexo(names, existing_sexes)
    merged["TIPO"] = tipo

    for field in (
        "ESPECIALIDAD",
        "CIUDAD",
        "TELEFONO",
        "EMAIL",
        "CATEGORIA",
        "PROGRAMACION",
        "MEDICO ID",
        "N°",
        "INST ID",
    ):
        merged[field] = next(
            (clean(record.get(field, "")) for record in records if clean(record.get(field, ""))),
            "",
        )

    merged["INSTITUCION"] = merge_values(records, "INSTITUCION")
    merged["ARCHIVO"] = merge_values(records, "ARCHIVO")

    duplicate_values = [boolean_value(record.get("DUPLICADO", "")) for record in records]
    if "True" in duplicate_values:
        merged["DUPLICADO"] = "True"
    else:
        merged["DUPLICADO"] = next((value for value in duplicate_values if value), "")

    if tipo == "ENTIDAD" and not merged["INSTITUCION"]:
        ambiguous.append(key)
    return merged


def write_csv(path, columns, records):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle, delimiter=";", lineterminator="\n")
        writer.writerow(columns)
        for record in records:
            values = []
            for column in columns:
                value = record.get(column, "")
                if column == "DIRECCION":
                    value = record.get("INSTITUCION", "")
                values.append(clean(value))
            writer.writerow(values)


def main():
    legacy_records = load_legacy(MEDICOS_OUT) + load_legacy(INSTITUCIONES_OUT)
    legacy_types = defaultdict(set)
    for record in legacy_records:
        tipo = record.get("TIPO", "")
        if tipo in {"MEDICO", "ENTIDAD"}:
            legacy_types[record_key(record)].add(tipo)

    groups = defaultdict(list)
    source_files = {
        path.resolve()
        for path in list(MEDICOS_DIR.glob("*.xlsx")) + list(INSTITUCIONES_DIR.glob("*.xlsx"))
    }
    for path in sorted(source_files):
        source_kind = "explicit" if path.name == "DATA.KARDEX.xlsx" else "regional"
        for record in load_kardex(path, source_kind):
            groups[record_key(record)].append(record)

    for record in legacy_records:
        key = record_key(record)
        if key not in groups:
            groups[key].append(record)

    merged_records = []
    ambiguous = []
    named_entities = []
    for key in sorted(groups):
        records = groups[key]
        tipo = choose_type(key, records, legacy_types, ambiguous, named_entities)
        merged_records.append(merge_group(key, records, tipo, ambiguous))

    medicos = sorted(
        (record for record in merged_records if record["TIPO"] == "MEDICO"),
        key=lambda record: (record["VISITADOR ASIGNADO"], norm_name(record["NOMBRE COMPLETO"]), record["NOMBRE COMPLETO"]),
    )
    instituciones = sorted(
        (record for record in merged_records if record["TIPO"] == "ENTIDAD"),
        key=lambda record: (record["VISITADOR ASIGNADO"], norm_name(record["NOMBRE COMPLETO"]), record["NOMBRE COMPLETO"]),
    )

    write_csv(MEDICOS_OUT, MEDICO_COLUMNS, medicos)
    write_csv(INSTITUCIONES_OUT, INSTITUCION_COLUMNS, instituciones)

    review_rows = []
    for record in medicos:
        specialty = clean(record["ESPECIALIDAD"]).upper()
        if specialty not in ENTITY_SPECIALTIES:
            continue
        row = empty_record()
        row["VISITADOR ASIGNADO"] = record["VISITADOR ASIGNADO"]
        row["NOMBRE COMPLETO"] = record["NOMBRE COMPLETO"]
        row["SITUACION"] = f"revisar: especialidad {specialty} en registro MEDICO"
        row["ESPECIALIDAD"] = record["ESPECIALIDAD"]
        row["INSTITUCION"] = record["INSTITUCION"]
        row["CIUDAD"] = record["CIUDAD"]
        row["ARCHIVO"] = record["ARCHIVO"]
        review_rows.append(row)
    for record in instituciones:
        if clean(record["INSTITUCION"]):
            continue
        row = empty_record()
        row["VISITADOR ASIGNADO"] = record["VISITADOR ASIGNADO"]
        row["NOMBRE COMPLETO"] = record["NOMBRE COMPLETO"]
        row["SITUACION"] = "revisar: entidad sin direccion"
        row["ESPECIALIDAD"] = record["ESPECIALIDAD"]
        row["INSTITUCION"] = record["INSTITUCION"]
        row["CIUDAD"] = record["CIUDAD"]
        row["ARCHIVO"] = record["ARCHIVO"]
        review_rows.append(row)
    review_rows.sort(key=lambda row: (row["VISITADOR ASIGNADO"], row["NOMBRE COMPLETO"]))
    write_csv(REVIEW_OUT, REVIEW_COLUMNS, review_rows)

    sex_counts = Counter(record["SEXO"] or "SIN DATO" for record in medicos)
    print(f"medicos: {len(medicos)}")
    print(f"instituciones: {len(instituciones)}")
    print("sexo:", dict(sex_counts))
    print(f"clasificados como ENTIDAD por nombre: {len(set(named_entities))}")
    print(f"por revisar: {len(review_rows)}")
    if ambiguous:
        print(f"registros ambiguos: {len(set(ambiguous))}")


if __name__ == "__main__":
    main()
