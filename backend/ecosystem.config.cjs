// PM2 process config for the Superfans backend.
//   pm2 start ecosystem.config.cjs
//   pm2 restart superfans-api
//   pm2 logs superfans-api
module.exports = {
  apps: [
    {
      name: 'superfans-api',
      script: 'dist/server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '600M',
      autorestart: true,
    },
  ],
};
