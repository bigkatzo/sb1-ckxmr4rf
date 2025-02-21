-- Drop all replication slots and subscriptions
DO $$ 
DECLARE
    v_slot_name text;
    v_subscription_name text;
    v_pid int;
BEGIN
    -- First terminate any active connections using replication slots
    FOR v_slot_name, v_pid IN 
        SELECT slot_name, active_pid 
        FROM pg_replication_slots 
        WHERE active_pid IS NOT NULL
    LOOP
        -- Terminate the process using the slot
        PERFORM pg_terminate_backend(v_pid);
        -- Wait a bit to ensure the connection is terminated
        PERFORM pg_sleep(1);
    END LOOP;

    -- Now drop all replication slots
    FOR v_slot_name IN 
        SELECT prs.slot_name 
        FROM pg_replication_slots prs
    LOOP
        PERFORM pg_drop_replication_slot(v_slot_name);
    END LOOP;

    -- Drop all subscriptions
    FOR v_subscription_name IN 
        SELECT ps.subname 
        FROM pg_subscription ps
    LOOP
        EXECUTE format('DROP SUBSCRIPTION IF EXISTS %I', v_subscription_name);
    END LOOP;

EXCEPTION WHEN OTHERS THEN
    -- Log any errors
    RAISE NOTICE 'Error dropping replication slot or subscription: %', SQLERRM;
    -- Continue with the next one
    NULL;
END $$;
