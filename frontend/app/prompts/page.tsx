'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Editor from '@monaco-editor/react';
import { getPrompts, updatePrompts } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Save, RefreshCw, Terminal, Info, ShieldCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function PromptsPage() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState<string>('{}');
  const [isValidJson, setIsValidJson] = useState(true);

  const { data: prompts, isLoading, isError, refetch } = useQuery({
    queryKey: ['prompts'],
    queryFn: getPrompts,
  });

  useEffect(() => {
    if (prompts) {
      setCode(JSON.stringify(prompts, null, 2));
    }
  }, [prompts]);

  const mutation = useMutation({
    mutationFn: updatePrompts,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      alert('Prompts updated successfully!');
    },
    onError: (error: any) => {
      alert(`Error updating prompts: ${error.message}`);
    },
  });

  const handleEditorChange = (value: string | undefined) => {
    const newCode = value || '{}';
    setCode(newCode);
    try {
      JSON.parse(newCode);
      setIsValidJson(true);
    } catch (e) {
      setIsValidJson(false);
    }
  };

  const handleSave = () => {
    if (!isValidJson) return;
    try {
      const parsed = JSON.parse(code);
      mutation.mutate(parsed);
    } catch (e) {
      setIsValidJson(false);
    }
  };

  if (isError) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Failed to load prompts from the server.</AlertDescription>
        </Alert>
        <Button onClick={() => refetch()} className="mt-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between px-2">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <Terminal className="text-primary" size={32} />
            Prompt Management
          </h1>
          <p className="text-muted-foreground mt-1 font-medium">Fine-tune the AI personas and messaging templates.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()} 
            disabled={isLoading}
            className="font-bold gap-2"
          >
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            REFRESH
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={mutation.isPending || !isValidJson || isLoading}
            className="font-bold gap-2 shadow-lg shadow-primary/20 min-w-[120px]"
          >
            {mutation.isPending ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : (
              <Save size={16} />
            )}
            SAVE CHANGES
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 overflow-hidden">
        <div className="lg:col-span-3 flex flex-col space-y-4 overflow-hidden">
          <Card className="flex-1 flex flex-col overflow-hidden border-primary/10 bg-card/30">
            <CardHeader className="py-3 px-4 border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">config/prompts.json</span>
                </div>
                {!isValidJson && (
                  <span className="text-[10px] font-black text-destructive uppercase tracking-tighter bg-destructive/10 px-2 py-0.5 rounded">
                    Invalid JSON detected
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              {isLoading ? (
                <div className="p-4 space-y-4">
                  <Skeleton className="h-8 w-1/3" />
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : (
                <Editor
                  height="100%"
                  defaultLanguage="json"
                  theme="vs-dark"
                  value={code}
                  onChange={handleEditorChange}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    fontFamily: 'JetBrains Mono, Menlo, Monaco, Courier New, monospace',
                    fontWeight: '600',
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    padding: { top: 20 },
                  }}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 overflow-y-auto pr-2">
          <Card className="bg-primary/5 border-primary/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest text-primary">
                <Info size={16} />
                Guidelines
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-3 font-medium text-muted-foreground leading-relaxed">
              <p>
                These prompts define how <span className="text-foreground font-bold">CUE AI</span> interacts with leads.
              </p>
              <ul className="space-y-2 list-disc pl-4">
                <li>Use <code className="bg-primary/10 px-1 rounded text-primary">{"{{name}}"}</code> for lead name.</li>
                <li>Use <code className="bg-primary/10 px-1 rounded text-primary">{"{{company}}"}</code> for lead company.</li>
                <li>Keep tones professional yet approachable.</li>
                <li>Avoid being overly salesy in first touches.</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2 uppercase tracking-widest">
                <ShieldCheck size={16} />
                Safety
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-3 font-medium text-muted-foreground">
              <p>
                All changes are audit-logged. Ensure JSON structure remains intact to prevent system-wide failures.
              </p>
              <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10 text-yellow-600 dark:text-yellow-500">
                <p className="flex items-center gap-2 font-bold uppercase tracking-tighter">
                  <Info size={12} />
                  Validation Active
                </p>
                <p className="mt-1">
                  The SAVE button is disabled if the JSON structure is invalid.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
