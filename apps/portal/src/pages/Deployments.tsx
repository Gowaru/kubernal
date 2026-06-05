import { useState, useCallback, type JSX } from 'react';
import { DeploymentTable } from '@/components/deployments/DeploymentTable';
import { DeploymentModal } from '@/components/deployments/DeploymentModal';
import { Button } from '@/components/ui/button';
import { Rocket } from 'lucide-react';

export default function Deployments(): JSX.Element {
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleDeploy = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Déploiements</h2>
          <p className="text-muted-foreground">Suivez et gérez les déploiements.</p>
        </div>
        <Button onClick={() => setShowDeployModal(true)}>
          <Rocket className="mr-2 h-4 w-4" />
          Nouveau déploiement
        </Button>
      </div>
      <DeploymentTable key={refreshKey} />
      <DeploymentModal
        open={showDeployModal}
        onOpenChange={setShowDeployModal}
        onDeploy={handleDeploy}
      />
    </div>
  );
}
