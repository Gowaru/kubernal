import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Rocket, Eye, RefreshCw } from 'lucide-react';
import { DeploymentModal } from '@/components/deployments/DeploymentModal';

export function QuickActions() {
  const navigate = useNavigate();
  const [showDeployModal, setShowDeployModal] = useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Actions rapides</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-11"
            onClick={() => setShowDeployModal(true)}
          >
            <Rocket className="h-4 w-4 text-blue-400" />
            Nouveau déploiement
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-11"
            onClick={() => navigate('/observability')}
          >
            <Eye className="h-4 w-4 text-violet-400" />
            Voir les logs
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-11"
            onClick={() => navigate('/catalogue')}
          >
            <PlusCircle className="h-4 w-4 text-emerald-400" />
            Nouvelle application
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-11"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-4 w-4 text-amber-400" />
            Rafraîchir
          </Button>
        </CardContent>
      </Card>

      <DeploymentModal
        open={showDeployModal}
        onOpenChange={setShowDeployModal}
      />
    </>
  );
}
