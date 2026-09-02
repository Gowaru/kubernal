import { useState, type JSX } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, X, Play } from 'lucide-react';
import { PodTerminal } from './PodTerminal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import type { K8sContainerStatus } from '@kubernal/shared-types';

interface PodTerminalDrawerProps {
  open: boolean;
  onClose: () => void;
  namespace: string;
  podName: string;
  containers: K8sContainerStatus[];
}

export function PodTerminalDrawer({
  open,
  onClose,
  namespace,
  podName,
  containers,
}: PodTerminalDrawerProps): JSX.Element {
  const [selectedContainer, setSelectedContainer] = useState<string>('');
  const [selectedShell, setSelectedShell] = useState('/bin/bash');
  const [connected, setConnected] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);

  const handleConnect = (): void => {
    setConnected(true);
    setSessionKey((k) => k + 1);
  };

  const handleClose = (): void => {
    setConnected(false);
    onClose();
  };

  const defaultContainer = containers.length === 1 ? containers[0]!.name : '';
  const effectiveContainer = selectedContainer || defaultContainer;

  return (
    <AnimatePresence>
      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-overlay/50 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 flex flex-col border-t border-x border-border rounded-t-lg"
            style={{ height: '65vh' }}
          >
            <div className="flex items-center justify-between px-4 py-2 bg-secondary border-t border-x border-border rounded-t-lg shrink-0">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-sm">{podName}</span>
                <span className="text-xs text-muted-foreground">{namespace}</span>
              </div>
              <button
                onClick={handleClose}
                className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-hidden bg-terminal-bg">
              {connected ? (
                <PodTerminal
                  key={sessionKey}
                  namespace={namespace}
                  podName={podName}
                  container={effectiveContainer || undefined}
                  shell={selectedShell}
                  onStatusChange={(s) => {
                    if (s === 'disconnected' || s === 'error') setConnected(false);
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="flex flex-col items-center gap-5 max-w-sm">
                    <Terminal className="h-12 w-12 text-muted-foreground/30" />
                    <h3 className="text-lg font-semibold">Terminal interactif</h3>

                    {containers.length > 1 && (
                      <div className="w-full space-y-1.5">
                        <label className="text-xs text-muted-foreground">Container</label>
                        <Select value={selectedContainer} onValueChange={setSelectedContainer}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Sélectionner un container" />
                          </SelectTrigger>
                          <SelectContent>
                            {containers.map((c) => (
                              <SelectItem key={c.name} value={c.name}>
                                {c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="w-full space-y-1.5">
                      <label className="text-xs text-muted-foreground">Shell</label>
                      <Select value={selectedShell} onValueChange={setSelectedShell}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="/bin/bash">/bin/bash</SelectItem>
                          <SelectItem value="/bin/sh">/bin/sh</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button onClick={handleConnect} className="w-full gap-2">
                      <Play className="h-4 w-4" />
                      Connecter
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
