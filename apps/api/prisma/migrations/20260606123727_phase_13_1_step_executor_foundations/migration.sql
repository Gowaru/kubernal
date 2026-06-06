-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "config" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "PipelineStep" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "action" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "output" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PipelineStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentVulnerability" (
    "id" TEXT NOT NULL,
    "deploymentId" TEXT NOT NULL,
    "cveId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "packageName" TEXT NOT NULL,
    "packageVersion" TEXT NOT NULL,
    "fixedVersion" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "scanSource" TEXT NOT NULL DEFAULT 'trivy',
    "rawReport" JSONB NOT NULL DEFAULT '{}',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeploymentVulnerability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PipelineStep_pipelineId_idx" ON "PipelineStep"("pipelineId");

-- CreateIndex
CREATE INDEX "PipelineStep_status_idx" ON "PipelineStep"("status");

-- CreateIndex
CREATE INDEX "DeploymentVulnerability_deploymentId_idx" ON "DeploymentVulnerability"("deploymentId");

-- CreateIndex
CREATE INDEX "DeploymentVulnerability_severity_idx" ON "DeploymentVulnerability"("severity");

-- CreateIndex
CREATE INDEX "DeploymentVulnerability_cveId_idx" ON "DeploymentVulnerability"("cveId");

-- AddForeignKey
ALTER TABLE "PipelineStep" ADD CONSTRAINT "PipelineStep_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentVulnerability" ADD CONSTRAINT "DeploymentVulnerability_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "Deployment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
