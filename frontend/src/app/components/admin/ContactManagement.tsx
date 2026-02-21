import { useState, useEffect } from 'react';
import { Mail, Eye, Trash2, CheckCircle, Archive, X, Search, Filter, Download } from 'lucide-react';
import { contactsService, ContactMessage } from '../../services/contacts';
import { toast } from 'sonner';

interface ContactManagementProps {
  refreshTrigger?: number;
}

export function ContactManagement({ refreshTrigger }: ContactManagementProps) {
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<ContactMessage | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDirection, setFilterDirection] = useState<string>('all');

  const statusOptions = [
    { value: 'all', label: 'Все статусы' },
    { value: 'new', label: 'Новые' },
    { value: 'read', label: 'Прочитано' },
    { value: 'replied', label: 'Отвечено' },
    { value: 'archived', label: 'Архивировано' },
  ];

  const directionOptions = [
    { value: 'all', label: 'Все направления' },
    { value: 'construction', label: 'Строительство и проектирование' },
    { value: 'engineering', label: 'Инженерные изыскания' },
    { value: 'education', label: 'Обучение' },
    { value: 'safety', label: 'Промышленная безопасность' },
    { value: 'other', label: 'Другое' },
  ];

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filterStatus !== 'all') {
        params.status = filterStatus;
      }
      if (filterDirection !== 'all') {
        params.direction = filterDirection;
      }
      const data = await contactsService.getMessages(params);
      setMessages(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Failed to fetch messages:', error);
      toast.error('Ошибка загрузки сообщений');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [filterStatus, filterDirection, refreshTrigger]);

  const handleStatusChange = async (message: ContactMessage, newStatus: 'new' | 'read' | 'replied' | 'archived') => {
    try {
      await contactsService.updateMessageStatus(message.id, newStatus);
      toast.success('Статус обновлен');
      fetchMessages();
      if (selectedMessage?.id === message.id) {
        setSelectedMessage({ ...message, status: newStatus });
      }
    } catch (error: any) {
      toast.error('Ошибка при обновлении статуса');
    }
  };

  const handleDelete = async (message: ContactMessage) => {
    if (!window.confirm(`Вы уверены, что хотите удалить сообщение от "${message.name}"?`)) {
      return;
    }

    try {
      await contactsService.deleteMessage(message.id);
      toast.success('Сообщение удалено');
      fetchMessages();
      if (selectedMessage?.id === message.id) {
        setSelectedMessage(null);
      }
    } catch (error: any) {
      toast.error('Ошибка при удалении сообщения');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new':
        return 'bg-blue-100 text-blue-800';
      case 'read':
        return 'bg-gray-100 text-gray-800';
      case 'replied':
        return 'bg-green-100 text-green-800';
      case 'archived':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredMessages = messages.filter(message => {
    const matchesSearch = 
      message.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      message.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      message.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (message.company && message.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
      message.message.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  if (loading && messages.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Загрузка сообщений...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Сообщения обратной связи</h2>
          <p className="text-gray-600 mt-1">Управление сообщениями от пользователей</p>
        </div>
        <button
          onClick={async () => {
            try {
              await contactsService.exportMessages();
              toast.success('Экспорт выполнен');
            } catch (err: any) {
              toast.error(err.message || 'Ошибка экспорта');
            }
          }}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Download className="w-4 h-4" />
          Экспорт
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Поиск по имени, email, телефону..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {statusOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          {/* Direction Filter */}
          <select
            value={filterDirection}
            onChange={(e) => setFilterDirection(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {directionOptions.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages List */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Отправитель</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Направление</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Статус</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Дата</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMessages.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        {searchQuery || filterStatus !== 'all' || filterDirection !== 'all'
                          ? 'Сообщения не найдены'
                          : 'Нет сообщений'}
                      </td>
                    </tr>
                  ) : (
                    filteredMessages.map(message => (
                      <tr
                        key={message.id}
                        className={`border-b border-gray-200 hover:bg-gray-50 cursor-pointer ${
                          selectedMessage?.id === message.id ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => setSelectedMessage(message)}
                      >
                        <td className="py-4 px-4">
                          <div className="font-medium text-gray-900">{message.name}</div>
                          <div className="text-sm text-gray-500">{message.email}</div>
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-700">
                          {message.direction_display || message.direction || '—'}
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(message.status)}`}>
                            {message.status_display || message.status}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-700">
                          {new Date(message.created_at).toLocaleDateString('ru-RU')}
                        </td>
                        <td className="py-4 px-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMessage(message);
                            }}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Просмотреть"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Message Detail */}
        <div className="lg:col-span-1">
          {selectedMessage ? (
            <div className="bg-white rounded-lg shadow-md p-6 sticky top-24">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Детали сообщения</h3>
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Имя</label>
                  <p className="text-gray-900">{selectedMessage.name}</p>
                </div>

                {selectedMessage.company && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Компания</label>
                    <p className="text-gray-900">{selectedMessage.company}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <p className="text-gray-900">
                    <a href={`mailto:${selectedMessage.email}`} className="text-blue-600 hover:underline">
                      {selectedMessage.email}
                    </a>
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Телефон</label>
                  <p className="text-gray-900">
                    <a href={`tel:${selectedMessage.phone}`} className="text-blue-600 hover:underline">
                      {selectedMessage.phone}
                    </a>
                  </p>
                </div>

                {selectedMessage.direction && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Направление</label>
                    <p className="text-gray-900">{selectedMessage.direction_display || selectedMessage.direction}</p>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium text-gray-700">Сообщение</label>
                  <p className="text-gray-900 whitespace-pre-wrap">{selectedMessage.message}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Дата отправки</label>
                  <p className="text-gray-900">
                    {new Date(selectedMessage.created_at).toLocaleString('ru-RU')}
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-200 space-y-2">
                  <label className="text-sm font-medium text-gray-700 block">Изменить статус</label>
                  <div className="flex flex-wrap gap-2">
                    {selectedMessage.status !== 'read' && (
                      <button
                        onClick={() => handleStatusChange(selectedMessage, 'read')}
                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                      >
                        Прочитано
                      </button>
                    )}
                    {selectedMessage.status !== 'replied' && (
                      <button
                        onClick={() => handleStatusChange(selectedMessage, 'replied')}
                        className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200 transition-colors"
                      >
                        Отвечено
                      </button>
                    )}
                    {selectedMessage.status !== 'archived' && (
                      <button
                        onClick={() => handleStatusChange(selectedMessage, 'archived')}
                        className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm hover:bg-purple-200 transition-colors"
                      >
                        Архив
                      </button>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={() => handleDelete(selectedMessage)}
                    className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm font-medium"
                  >
                    Удалить сообщение
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-md p-12 text-center">
              <Mail className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Выберите сообщение для просмотра</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

