import { useState, useEffect } from 'react';
import { protocolsService } from '../services/protocols';
import { Protocol } from '../types/lms';
import { adaptProtocol } from '../utils/typeAdapters';

export function useProtocols(params?: { user?: string; status?: string }) {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProtocols = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await protocolsService.getProtocols(params);
        // Данные уже адаптированы в protocolsService.getProtocols()
        // Защита от не-массивов
        const dataArray = Array.isArray(data) ? data : [];
        console.log('Fetched protocols:', dataArray);
        setProtocols(dataArray);
      } catch (err: any) {
        setError(err.message || 'Ошибка загрузки протоколов');
        console.error('Failed to fetch protocols:', err);
        setProtocols([]); // Устанавливаем пустой массив при ошибке
      } finally {
        setLoading(false);
      }
    };

    fetchProtocols();
  }, [params?.user, params?.status]);

  const refetch = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await protocolsService.getProtocols(params);
      // Защита от не-массивов и адаптация данных
      const dataArray = Array.isArray(data) ? data : [];
      const adaptedProtocols = dataArray.map(adaptProtocol);
      setProtocols(adaptedProtocols);
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки протоколов');
      console.error('Failed to fetch protocols:', err);
      setProtocols([]); // Устанавливаем пустой массив при ошибке
    } finally {
      setLoading(false);
    }
  };

  return { protocols, loading, error, refetch };
}

