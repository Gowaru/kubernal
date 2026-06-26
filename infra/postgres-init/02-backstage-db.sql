-- Create the Backstage database if it does not exist
SELECT 'CREATE DATABASE kubernal_backstage'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'kubernal_backstage')\gexec
