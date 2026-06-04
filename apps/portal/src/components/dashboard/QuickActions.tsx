import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusCircle, Rocket, Eye, RefreshCw } from 'lucide-react';
import { DeploymentModal } from '@/components/deployments/DeploymentModal';

export function QuickActions() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
            <Rocket className="h-4 w-4 text-accent" />
            Nouveau déploiement
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-11"
            onClick={() => navigate('/observability')}
          >
            <Eye className="h-4 w-4 text-accent" />
            Voir les logs
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-11"
            onClick={() => navigate('/catalogue')}
          >
            <PlusCircle className="h-4 w-4 text-status-success" />
            Nouvelle application
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-11"
            onClick={() => { queryClient.invalidateQueries(); toast.success('Données rafraîchies'); }}
          >
            <RefreshCw className="h-4 w-4 text-status-warning" />
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
