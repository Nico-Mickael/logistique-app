import { useState, useRef, useMemo } from 'react';
import {
  Paper, Title, Badge, Center, Text, Group, Button, Select, Stack, Code, Alert, Table, Progress, Tooltip, Flex,
} from '@mantine/core';
import { IconUpload, IconFileDownload, IconCheck, IconX, IconAlertCircle, IconArrowRight, IconRefresh } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import api from '../../api/axios';

export default function Import() {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [mappingOverride, setMappingOverride] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      notifications.show({ color: 'red', title: 'Erreur', message: 'Formats acceptés : CSV, XLSX, XLS' });
      return;
    }
    setFile(f);
    setAnalysis(null);
    setResult(null);
    setMappingOverride(null);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post('/import/analyze', fd);
      setAnalysis(data);
      setMappingOverride(null);
    } catch (err) {
      notifications.show({ color: 'red', title: 'Erreur', message: err.response?.data?.message || 'Erreur d\'analyse' });
    } finally { setLoading(false); }
  };

  const setMapping = (fieldKey, col) => {
    setMappingOverride(prev => ({ ...prev, [fieldKey]: col }));
  };

  const currentMapping = useMemo(() => {
    if (!analysis) return null;
    const base = {};
    analysis.mapping.forEach(m => { base[m.key] = m.detectedColumn; });
    return { ...base, ...mappingOverride };
  }, [analysis, mappingOverride]);

  const unmatchedColumns = useMemo(() => {
    if (!analysis || !currentMapping) return [];
    const used = Object.values(currentMapping).filter(Boolean);
    return analysis.columns.filter(c => !used.includes(c));
  }, [analysis, currentMapping]);

  const handleExecute = async () => {
    if (!file || !analysis) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('entity', analysis.entity);
      fd.append('mapping', JSON.stringify(currentMapping));
      const { data } = await api.post('/import/execute', fd);
      setResult(data);
      notifications.show({
        color: data.errors === 0 ? 'green' : 'orange',
        title: 'Import terminé',
        message: `${data.imported} ligne(s) importée(s), ${data.errors} erreur(s)`,
      });
    } catch (err) {
      notifications.show({ color: 'red', title: 'Erreur', message: err.response?.data?.message || 'Erreur d\'import' });
    } finally { setImporting(false); }
  };

  const reset = () => {
    setFile(null);
    setAnalysis(null);
    setResult(null);
    setMappingOverride(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const colOptions = (analysis?.columns || []).map(c => ({ value: c, label: c }));

  return (
    <div className="page-content">
      <Title order={3} mb="lg">Importation de données</Title>

      {/* Step 1: Choose file */}
      <Paper p="lg" radius="lg" withBorder className="step-panel" mb="md">
        <Group mb="sm">
          <Badge circle size="md" color="brand">1</Badge>
          <Title order={5}>Sélectionner le fichier</Title>
        </Group>
        <Text size="sm" c="dimmed" mb="sm">Formats acceptés : CSV, XLSX, XLS</Text>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: 'none' }} onChange={handleFileChange} />
        <Group>
          <Button variant="outline" leftSection={<IconUpload size={16} />} onClick={() => fileRef.current?.click()}>
            Choisir un fichier
          </Button>
          {file && (
            <>
              <Badge color="brand" variant="light">{file.name} ({(file.size / 1024).toFixed(1)} Ko)</Badge>
              <Button variant="subtle" size="xs" onClick={reset}>Changer</Button>
            </>
          )}
        </Group>
      </Paper>

      {file && !analysis && (
        <Paper p="lg" radius="lg" withBorder className="step-panel" mb="md">
          <Group mb="sm">
            <Badge circle size="md" color="brand">2</Badge>
            <Title order={5}>Analyser le fichier</Title>
          </Group>
          <Text size="sm" c="dimmed" mb="sm">Détection automatique des colonnes et du type de données</Text>
          <Button color="brand" onClick={handleAnalyze} loading={loading}>
            {loading ? 'Analyse...' : 'Lancer l\'analyse'}
          </Button>
        </Paper>
      )}

      {/* Step 2: Review mapping */}
      {analysis && !result && (
        <>
          <Paper p="lg" radius="lg" withBorder className="step-panel" mb="md">
            <Group mb="sm">
              <Badge circle size="md" color="brand">2</Badge>
              <Title order={5}>Correspondance détectée</Title>
              <Badge color="brand" variant="light">{analysis.entityLabel}</Badge>
              <Badge color="gray" variant="light">{analysis.totalRows} ligne(s)</Badge>
              <Badge color={analysis.confidence >= 1 ? 'green' : 'orange'} variant="light">
                Confiance : {Math.round(analysis.confidence * 100)}%
              </Badge>
            </Group>

            <Table striped highlightOnHover mb="md" fontSize="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Champ système</Table.Th>
                  <Table.Th>Colonne détectée</Table.Th>
                  <Table.Th>Statut</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {analysis.mapping.map(m => {
                  const override = currentMapping?.[m.key];
                  return (
                    <Table.Tr key={m.key}>
                      <Table.Td>
                        <Text fw={500} size="sm">{m.label}</Text>
                        {m.required && <Text span c="red" size="xs"> *</Text>}
                      </Table.Td>
                      <Table.Td>
                        <select
                          value={override || ''}
                          onChange={e => setMapping(m.key, e.target.value || null)}
                          style={{
                            padding: '4px 8px', borderRadius: 6, border: '1px solid #ddd',
                            width: '100%', maxWidth: 280, fontSize: 13,
                          }}
                        >
                          <option value="">— Non mappé —</option>
                          {colOptions.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </Table.Td>
                      <Table.Td>
                        {override ? (
                          <Badge color="green" variant="light" size="sm">Mappé</Badge>
                        ) : (
                          <Badge color="red" variant="light" size="sm">Non mappé</Badge>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
                {unmatchedColumns.map(col => (
                  <Table.Tr key={col}>
                    <Table.Td><Text c="dimmed" size="sm">—</Text></Table.Td>
                    <Table.Td><Text size="sm" c="dimmed">{col}</Text></Table.Td>
                    <Table.Td><Badge color="gray" variant="light" size="sm">Ignoré</Badge></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            <Progress value={analysis.confidence * 100} color={analysis.confidence >= 1 ? 'brand' : 'yellow'} size="sm" mb="md" />
          </Paper>

          {/* Preview */}
          <Paper p="lg" radius="lg" withBorder className="step-panel" mb="md">
            <Group mb="sm">
              <Badge circle size="md" color="brand">3</Badge>
              <Title order={5}>Aperçu des données ({Math.min(analysis.preview.length, analysis.totalRows)} premières lignes)</Title>
            </Group>
            {analysis.preview.length > 0 && (
              <div style={{ overflowX: 'auto' }}>
                <Table striped highlightOnHover fontSize="xs">
                  <Table.Thead>
                    <Table.Tr>
                      {Object.keys(analysis.preview[0]).map(k => (
                        <Table.Th key={k} size="sm">{k}</Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {analysis.preview.map((row, i) => (
                      <Table.Tr key={i}>
                        {Object.values(row).map((v, j) => <Table.Td key={j} size="sm">{v || '—'}</Table.Td>)}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </div>
            )}
          </Paper>

          {/* Execute */}
          <Paper p="lg" radius="lg" withBorder className="step-panel" mb="md">
            <Group mb="sm">
              <Badge circle size="md" color="brand">4</Badge>
              <Title order={5}>Lancer l'importation</Title>
            </Group>
            <Group>
              <Button color="brand" leftSection={<IconUpload size={16} />} onClick={handleExecute} loading={importing}
                disabled={currentMapping && Object.keys(currentMapping).filter(k => analysis.mapping.find(m => m.key === k && m.required) && !currentMapping[k]).length > 0}>
                {importing ? 'Importation...' : 'Importer'}
              </Button>
              <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={reset}>Recommencer</Button>
            </Group>
          </Paper>
        </>
      )}

      {/* Result */}
      {result && (
        <Paper p="lg" radius="lg" withBorder className="step-panel" mb="md">
          <Group mb="sm">
            <Badge circle size="md" color={result.errors === 0 ? 'green' : 'orange'}>
              {result.errors === 0 ? <IconCheck size={12} /> : <IconX size={12} />}
            </Badge>
            <Title order={5}>Résultat</Title>
          </Group>
          <Group mb="sm">
            <Badge color="brand" variant="light" size="lg">{result.imported} importé(s)</Badge>
            <Badge color={result.errors > 0 ? 'red' : 'gray'} variant="light" size="lg">{result.errors} erreur(s)</Badge>
            <Badge color="gray" variant="light" size="lg">{result.total} ligne(s)</Badge>
          </Group>
          {result.details?.created?.length > 0 && (
            <>
              <Text size="sm" fw={500} mb="xs">Importés :</Text>
              <Table striped highlightOnHover mb="md" fontSize="xs">
                <Table.Thead><Table.Tr>
                  {Object.keys(result.details.created[0]).map(k => <Table.Th key={k}>{k}</Table.Th>)}
                </Table.Tr></Table.Thead>
                <Table.Tbody>
                  {result.details.created.map((item, i) => (
                    <Table.Tr key={i}>{Object.values(item).map((v, j) => <Table.Td key={j}>{v}</Table.Td>)}</Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </>
          )}
          {result.details?.errors?.length > 0 && (
            <>
              <Text size="sm" fw={500} c="red" mb="xs">Erreurs :</Text>
              {result.details.errors.map((e, i) => (
                <Alert key={i} icon={<IconAlertCircle size={14} />} color="red" variant="light" p="xs" mb={4}>
                  <Text size="xs">{e}</Text>
                </Alert>
              ))}
            </>
          )}
          <Button variant="outline" mt="md" onClick={reset}>Nouvel import</Button>
        </Paper>
      )}

      <style>{`
        .page-content { animation: fade-in 0.3s ease-out; max-width: 860px; margin: 0 auto; }
        .step-panel { animation: panel-in 0.4s ease-out; }
        select { font-family: inherit; }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes panel-in { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
