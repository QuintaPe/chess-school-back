import cron from 'node-cron';

export const initScheduler = () => {
    // Daily puzzle feature removed.
    // Keeping scheduler entrypoint to avoid touching server bootstrap.
    void cron;
};
