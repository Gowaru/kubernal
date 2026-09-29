-- B3: suppression en cascade — les FK sans `onDelete` explicite étaient à RESTRICT,
-- ce qui transformait toute suppression avec enfants en 500 INTERNAL_ERROR
-- (violation de contrainte FK non traduite par l'error handler).
--
-- Application.owner        -> CASCADE : le portail promet « Supprime définitivement votre
--                             compte et toutes les données associées ». La FK est scopée à
--                             ownerId : seules les apps de cet owner sont supprimées.
-- Environment.application  -> CASCADE : une app emporte ses environnements.
-- Deployment.application   -> CASCADE : sans cela la suppression d'une app restait bloquée.
-- Deployment.environment   -> CASCADE : l'API n'expose pas de DELETE /deployments/:id, un
--                             RESTRICT rendrait les environnements peuplés indétruits.
--                             La voie non destructive reste POST /applications/:id/archive.
-- Pipeline.deployment      -> CASCADE : un pipeline n'a pas de sens sans son déploiement
--                             (idem DeploymentVulnerability qui cascade déjà).
--
-- Deployment.approvedBy reste SET NULL et User.teamId reste SET NULL : l'historique
-- d'approbation des déploiements survit à la suppression de l'utilisateur.
-- Vérifié au préalable : 0 ligne orpheline sur les 17 relations (aucun nettoyage requis).

-- DropForeignKey
ALTER TABLE "Application" DROP CONSTRAINT "Application_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "Deployment" DROP CONSTRAINT "Deployment_applicationId_fkey";

-- DropForeignKey
ALTER TABLE "Deployment" DROP CONSTRAINT "Deployment_environmentId_fkey";

-- DropForeignKey
ALTER TABLE "Environment" DROP CONSTRAINT "Environment_applicationId_fkey";

-- DropForeignKey
ALTER TABLE "Pipeline" DROP CONSTRAINT "Pipeline_deploymentId_fkey";

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Environment" ADD CONSTRAINT "Environment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
