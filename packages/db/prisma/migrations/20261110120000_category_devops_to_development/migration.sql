-- Rename the "DEVOPS" category value to "DEVELOPMENT" (PRD §8.2 update).
UPDATE "tracker" SET "category" = 'DEVELOPMENT' WHERE "category" = 'DEVOPS';
