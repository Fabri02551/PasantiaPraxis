-- ============================================================
-- Praxis CRM - Roles de replicacion fisica (mirror)
--
-- Este script solo se ejecuta la PRIMERA vez que se crea el
-- volumen de datos (initdb). Si el volumen ya existe, Docker no
-- vuelve a correr los scripts de /docker-entrypoint-initdb.d.
-- Para agregarlos a una base ya inicializada ver docker/README.md.
-- ============================================================

-- ---------------------------------------------------------------
-- replicator: el rol que usa el espejo para el streaming de WAL.
-- Necesita el atributo REPLICATION, nada mas.
-- ---------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'replicator') THEN
        CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'replicator_secret';
        RAISE NOTICE 'Rol replicator creado';
    ELSE
        RAISE NOTICE 'El rol replicator ya existe';
    END IF;
END
$$;

-- ---------------------------------------------------------------
-- rewind_user: rol de SOLO LECTURA para que pg_rewind pueda leer
-- los archivos del directorio de datos durante un failback.
--
-- Es un rol aparte a proposito: pg_read_binary_file permite leer
-- cualquier archivo del datadir y no conviene que un rol usado
-- continuamente para replicar tenga ese privilegio. Es lo que
-- recomienda la propia documentacion de pg_rewind.
-- ---------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rewind_user') THEN
        CREATE ROLE rewind_user LOGIN PASSWORD 'rewind_user_secret';
        RAISE NOTICE 'Rol rewind_user creado';
    ELSE
        RAISE NOTICE 'El rol rewind_user ya existe';
    END IF;
END
$$;

-- ---------------------------------------------------------------
-- Los permisos se dan recorriendo pg_proc en vez de escribir las
-- firmas a mano, porque hay varias sobrecargas y cambiaron entre
-- versiones. Ojo: la documentacion de pg_rewind sigue citando
-- "pg_stat_file(text, text)", que ya no existe (en PG16 es
-- pg_stat_file(text, boolean)), asi que un GRANT a mano falla.
--
-- IMPORTANTE: los ACL de funciones viven en pg_proc, que es un
-- catalogo POR BASE DE DATOS. Hay que repetir el granting en cada
-- base desde la que se vaya a conectar pg_rewind. Este script
-- corre sobre praxis_crm, y failover.sh conecta pg_rewind contra
-- "postgres", asi que se hace en las dos.
-- ---------------------------------------------------------------
\connect praxis_crm
DO $$
DECLARE
    fn text;
BEGIN
    FOR fn IN
        SELECT oid::regprocedure::text
        FROM pg_proc
        WHERE pronamespace = 'pg_catalog'::regnamespace
          AND proname IN ('pg_ls_dir', 'pg_stat_file', 'pg_read_binary_file')
    LOOP
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO rewind_user', fn);
    END LOOP;
    RAISE NOTICE 'permisos de rewind_user aplicados sobre praxis_crm';
END
$$;

\connect postgres
DO $$
DECLARE
    fn text;
BEGIN
    FOR fn IN
        SELECT oid::regprocedure::text
        FROM pg_proc
        WHERE pronamespace = 'pg_catalog'::regnamespace
          AND proname IN ('pg_ls_dir', 'pg_stat_file', 'pg_read_binary_file')
    LOOP
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO rewind_user', fn);
    END LOOP;
    RAISE NOTICE 'permisos de rewind_user aplicados sobre postgres';
END
$$;

GRANT CONNECT ON DATABASE praxis_crm TO replicator;
GRANT CONNECT ON DATABASE praxis_crm TO rewind_user;
