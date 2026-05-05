
import React, { useState, useEffect, useRef } from 'react';
import { User, LoyaltyConfig, StampCard, UserRole } from '../types';
import { StorageService } from '../services/storageService';
import { Button, Input, Card } from './ui/Shared';
import { Users, Settings, PlusCircle, MinusCircle, Award, Search, QrCode, X, Upload, Image as ImageIcon, Briefcase, Trash2, UserPlus } from 'lucide-react';
import { Html5QrcodeScanner } from "html5-qrcode";

// Internal component for the QR Scanner Modal
const QrScannerModal: React.FC<{ onClose: () => void, onScan: (text: string) => void }> = ({ onClose, onScan }) => {
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
        if (!scannerRef.current) {
            const scanner = new Html5QrcodeScanner(
                "reader",
                { 
                    fps: 10, 
                    qrbox: { width: 250, height: 250 },
                    aspectRatio: 1.0,
                    showTorchButtonIfSupported: true
                },
                false
            );
            
            scannerRef.current = scanner;

            scanner.render((text) => {
                scanner.clear().then(() => {
                   onScan(text);
                }).catch(err => console.error("Failed to clear scanner", err));
            }, (error) => {});
        }
    }, 100);

    return () => {
        clearTimeout(timer);
        if (scannerRef.current) {
            scannerRef.current.clear().catch(console.error);
        }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
        <div className="bg-white rounded-2xl p-6 w-full max-w-md relative shadow-2xl">
            <button 
                onClick={onClose} 
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors z-10"
            >
                <X className="w-6 h-6" />
            </button>
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <QrCode className="w-5 h-5 mr-2 text-brand-600" />
                Escanear Cliente
            </h3>
            <div className="overflow-hidden rounded-xl bg-gray-100 border-2 border-dashed border-gray-300">
                 <div id="reader" className="w-full h-full"></div>
            </div>
            <p className="text-center text-sm text-gray-500 mt-4">
                Aponte a câmera para o QR Code no celular do cliente.
            </p>
        </div>
    </div>
  );
};

export const AdminDashboard: React.FC<{ onLogout: () => void, currentUser: User }> = ({ onLogout, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'settings' | 'team'>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [staffList, setStaffList] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [config, setConfig] = useState<LoyaltyConfig>({} as LoyaltyConfig);
  const [cards, setCards] = useState<StampCard[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // New Staff State
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');

  // ------------------------------------
  // REALTIME SUBSCRIPTIONS
  // ------------------------------------
  useEffect(() => {
    const unsubUsers = StorageService.subscribeToUsers((allUsers) => {
        setUsers(allUsers.filter(u => u.role === UserRole.CUSTOMER));
        setStaffList(allUsers.filter(u => u.role === UserRole.STAFF));
    });

    const unsubCards = StorageService.subscribeToCards((allCards) => {
        setCards(allCards);
    });

    const unsubConfig = StorageService.subscribeToConfig((cfg) => {
        setConfig(cfg);
    });

    return () => {
        unsubUsers();
        unsubCards();
        unsubConfig();
    };
  }, []);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredUsers(users);
    } else {
      const lowerTerm = searchTerm.toLowerCase();
      setFilteredUsers(users.filter(u => 
        u.name.toLowerCase().includes(lowerTerm) || 
        u.email.toLowerCase().includes(lowerTerm) ||
        u.phone?.includes(lowerTerm) ||
        u.id === searchTerm 
      ));
    }
  }, [searchTerm, users]);

  // ------------------------------------
  // ACTIONS
  // ------------------------------------

  const handleAddStamp = async (userId: string) => {
    setLoading(true);
    await StorageService.addStamp(userId, config);
    setLoading(false);
  };

  const handleRemoveStamp = async (userId: string) => {
    if (confirm('Deseja remover 1 selo deste cliente?')) {
        setLoading(true);
        await StorageService.removeStamp(userId);
        setLoading(false);
    }
  };

  const handleRedeem = async (userId: string) => {
    if (confirm('Confirmar resgate do prêmio? Isso zerará o cartão do cliente.')) {
      setLoading(true);
      await StorageService.redeemCard(userId);
      setLoading(false);
    }
  };

  const handleScanSuccess = (decodedText: string) => {
      setShowScanner(false);
      setSearchTerm(decodedText);
      const found = users.find(u => u.id === decodedText);
      if (found) {
          alert(`Cliente encontrado: ${found.name}`);
      } else {
          alert('Cliente não encontrado com este QR Code.');
      }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) { 
        alert("O logotipo deve ser menor que 500KB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setConfig(prev => ({ ...prev, logo: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveConfig = async () => {
    setLoading(true);
    await StorageService.saveConfig(config);
    setLoading(false);
    alert("Configurações salvas!");
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newStaffName || !newStaffEmail || !newStaffPassword) return alert("Preencha todos os campos.");
      
      setLoading(true);
      try {
          await StorageService.register(newStaffName, newStaffEmail, '', newStaffPassword, UserRole.STAFF);
          setNewStaffName('');
          setNewStaffEmail('');
          setNewStaffPassword('');
          alert("Membro da equipe adicionado!");
      } catch (err: any) {
          alert("Erro ao criar membro: " + err.message);
      } finally {
          setLoading(false);
      }
  };

  const handleDeleteStaff = async (id: string) => {
      if (confirm("Tem certeza que deseja remover este acesso?")) {
          await StorageService.deleteUser(id);
      }
  };

  const isAdmin = currentUser.role === UserRole.ADMIN;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white shadow-sm px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {config.logo ? (
            <img src={config.logo} alt="Logo" className="h-8 object-contain" />
          ) : (
            <h1 className="text-xl font-bold text-gray-800">Painel {isAdmin ? 'Admin' : 'Equipe'}</h1>
          )}
        </div>
        <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden md:block">{currentUser.name} ({isAdmin ? 'Gestor' : 'Equipe'})</span>
            <Button variant="ghost" onClick={onLogout} className="text-red-500 hover:bg-red-50 hover:text-red-600">Sair</Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        
        {/* Tabs */}
        <div className="flex space-x-2 bg-white p-1 rounded-xl shadow-sm w-fit mx-auto md:mx-0 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-brand-100 text-brand-800' : 'text-gray-500 hover:text-gray-900'}`}
          >
            <div className="flex items-center"><Users className="w-4 h-4 mr-2" /> Clientes</div>
          </button>
          
          {isAdmin && (
              <>
                <button 
                    onClick={() => setActiveTab('team')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'team' ? 'bg-brand-100 text-brand-800' : 'text-gray-500 hover:text-gray-900'}`}
                >
                    <div className="flex items-center"><Briefcase className="w-4 h-4 mr-2" /> Equipe</div>
                </button>
                <button 
                    onClick={() => setActiveTab('settings')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'settings' ? 'bg-brand-100 text-brand-800' : 'text-gray-500 hover:text-gray-900'}`}
                >
                    <div className="flex items-center"><Settings className="w-4 h-4 mr-2" /> Configurações</div>
                </button>
              </>
          )}
        </div>

        {activeTab === 'users' && (
          <div className="space-y-4">
             {/* Search Bar & Scan Button */}
             <div className="flex gap-2">
                 <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <Input 
                      placeholder="Buscar por nome, email ou escanear..." 
                      className="pl-10"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                 </div>
                 <Button onClick={() => setShowScanner(true)} className="px-3 md:px-4 shrink-0" title="Escanear QR Code">
                    <QrCode className="w-5 h-5 md:mr-2" />
                    <span className="hidden md:inline">Escanear</span>
                 </Button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredUsers.map(user => {
                const activeCard = cards.find(c => c.userId === user.id && !c.redeemed) || { currentStamps: 0, completed: false };
                const isCompleted = activeCard.completed;
                const canRemove = (activeCard.currentStamps || 0) > 0 && !isCompleted;
                const progress = activeCard.currentStamps ? (activeCard.currentStamps / config.totalStamps) * 100 : 0;
                
                return (
                  <Card key={user.id} className="flex flex-col justify-between hover:shadow-lg transition-shadow border-l-4 border-brand-500">
                    <div>
                      <div className="flex justify-between items-start">
                        <h3 className="font-bold text-lg text-gray-800">{user.name}</h3>
                        <div className="flex flex-col items-end">
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500 mb-1">{user.phone}</span>
                          <span className="text-[10px] text-gray-400 font-mono">ID: {user.id.slice(0, 8)}...</span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 mb-4">{user.email}</p>
                      
                      <div className="flex items-center space-x-2 mb-4">
                        <div className="flex-1 bg-gray-200 h-2 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-brand-500" 
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-brand-700">{activeCard.currentStamps || 0}/{config.totalStamps}</span>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-2">
                      {isCompleted ? (
                        <Button 
                          onClick={() => handleRedeem(user.id)} 
                          className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
                          isLoading={loading}
                        >
                          <Award className="w-4 h-4 mr-2" /> Resgatar Prêmio
                        </Button>
                      ) : (
                        <div className="flex gap-2 w-full">
                            <Button 
                                onClick={() => handleRemoveStamp(user.id)} 
                                variant="secondary"
                                className="px-3"
                                title="Remover último selo"
                                disabled={!canRemove || loading}
                            >
                                <MinusCircle className="w-4 h-4" />
                            </Button>
                            <Button 
                              onClick={() => handleAddStamp(user.id)} 
                              className="flex-1"
                              isLoading={loading}
                            >
                              <PlusCircle className="w-4 h-4 mr-2" /> Adicionar Selo
                            </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
              
              {filteredUsers.length === 0 && (
                <div className="col-span-full text-center py-12 text-gray-400 bg-white rounded-xl border border-dashed border-gray-200">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p>{searchTerm ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'team' && isAdmin && (
            <div className="space-y-6">
                <Card>
                    <h3 className="font-bold text-gray-800 mb-4 flex items-center">
                        <UserPlus className="w-5 h-5 mr-2 text-brand-600" />
                        Adicionar Membro da Equipe
                    </h3>
                    <form onSubmit={handleCreateStaff} className="grid md:grid-cols-3 gap-4 items-end">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Nome</label>
                            <Input value={newStaffName} onChange={e => setNewStaffName(e.target.value)} placeholder="Ex: Maria Caixa" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Email de Acesso</label>
                            <Input value={newStaffEmail} onChange={e => setNewStaffEmail(e.target.value)} placeholder="email@loja.com" type="email" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">Senha Provisória</label>
                            <Input value={newStaffPassword} onChange={e => setNewStaffPassword(e.target.value)} placeholder="******" type="password" />
                        </div>
                        <Button type="submit" className="md:col-span-3 mt-2" isLoading={loading}>Cadastrar Membro</Button>
                    </form>
                </Card>

                <div className="grid gap-4">
                    <h3 className="font-bold text-gray-700 px-1">Equipe Atual</h3>
                    {staffList.map(staff => (
                        <Card key={staff.id} className="flex justify-between items-center py-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center font-bold">
                                    {staff.name.charAt(0)}
                                </div>
                                <div>
                                    <p className="font-bold text-gray-800">{staff.name}</p>
                                    <p className="text-sm text-gray-500">{staff.email}</p>
                                </div>
                            </div>
                            <Button 
                                variant="ghost" 
                                onClick={() => handleDeleteStaff(staff.id)}
                                className="text-gray-400 hover:text-red-500 hover:bg-red-50"
                                title="Remover acesso"
                            >
                                <Trash2 className="w-5 h-5" />
                            </Button>
                        </Card>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'settings' && isAdmin && (
          <div className="grid gap-6">
            <Card>
              <h3 className="font-bold text-gray-800 mb-4 border-b pb-2">Configuração Manual</h3>
              
              <div className="space-y-4">
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">Logotipo</label>
                   <div className="flex items-center space-x-4">
                      <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200 overflow-hidden relative">
                         {config.logo ? (
                            <img src={config.logo} alt="Logo Preview" className="w-full h-full object-contain" />
                         ) : (
                            <ImageIcon className="text-gray-300 w-8 h-8" />
                         )}
                      </div>
                      <div className="flex-1">
                          <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500">
                             <Upload className="w-4 h-4 mr-2" />
                             Enviar Logotipo
                             <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                          </label>
                      </div>
                   </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Negócio</label>
                  <Input 
                    value={config.businessName || ''}
                    onChange={(e) => setConfig({...config, businessName: e.target.value})}
                    className="text-gray-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Total de Selos</label>
                    <Input 
                      type="number"
                      min="1"
                      max="20"
                      value={config.totalStamps || 10}
                      onChange={(e) => setConfig({...config, totalStamps: Number(e.target.value)})}
                      className="text-gray-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cor do Tema</label>
                    <select 
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-brand-500 outline-none bg-white text-gray-500"
                        value={config.themeColor || 'brand'}
                        onChange={(e) => setConfig({...config, themeColor: e.target.value})}
                    >
                        <option value="brand">Vermelho (Padrão)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição do Prêmio</label>
                  <Input 
                    value={config.rewardDescription || ''}
                    onChange={(e) => setConfig({...config, rewardDescription: e.target.value})}
                    className="text-gray-500"
                  />
                </div>

                <div className="pt-4 flex justify-end">
                  <Button onClick={handleSaveConfig} isLoading={loading}>Salvar Alterações</Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {showScanner && (
            <QrScannerModal 
                onClose={() => setShowScanner(false)} 
                onScan={handleScanSuccess} 
            />
        )}
      </main>
    </div>
  );
};
