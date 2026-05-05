
import React, { useEffect, useState } from 'react';
import { User, LoyaltyConfig, StampCard } from '../types';
import { StorageService } from '../services/storageService';
import { LoyaltyCard } from './LoyaltyCard';
import { Button, Card } from './ui/Shared';
import { History, LogOut } from 'lucide-react';

export const CustomerDashboard: React.FC<{ user: User; onLogout: () => void }> = ({ user, onLogout }) => {
  const [config, setConfig] = useState<LoyaltyConfig>({} as LoyaltyConfig);
  const [activeCard, setActiveCard] = useState<StampCard | null>(null);
  
  // Realtime Listeners
  useEffect(() => {
    // 1. Subscribe to Config
    const unsubConfig = StorageService.subscribeToConfig((c) => setConfig(c));

    // 2. Subscribe to Cards to find my active card
    const unsubCards = StorageService.subscribeToCards(async (allCards) => {
        // Find user's active card in the updated list
        let myCard = allCards.find(c => c.userId === user.id && !c.redeemed);
        
        // If no active card exists (should be rare if created on signup), create one
        if (!myCard) {
            // Note: In a real app, this create logic might be better placed in backend triggers,
            // but for this client-side logic, we double check.
            try {
               myCard = await StorageService.getOrCreateActiveCard(user.id);
            } catch(e) {
                // Ignore concurrent creation errors
            }
        }
        setActiveCard(myCard || null);
    });

    return () => {
        unsubConfig();
        unsubCards();
    };
  }, [user.id]);

  if (!activeCard || !config.businessName) return <div className="p-8 text-center text-gray-500">Carregando fidelidade...</div>;

  return (
    <div className="min-h-screen bg-brand-50 flex flex-col">
      {/* Top Navbar */}
      <div className="bg-white shadow-sm p-4 flex justify-between items-center z-10">
        <div className="flex items-center space-x-2">
            {config.logo ? (
                <img src={config.logo} alt="Logo" className="w-8 h-8 object-contain rounded-full bg-gray-50" />
            ) : (
                <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-600 font-bold">
                    {user.name.charAt(0)}
                </div>
            )}
            <div>
                <p className="text-xs text-gray-500">Olá, {user.name.split(' ')[0]}</p>
                <p className="text-sm font-bold text-gray-800 leading-none">{config.businessName}</p>
            </div>
        </div>
        <Button variant="ghost" onClick={onLogout} className="p-2">
            <LogOut className="w-5 h-5" />
        </Button>
      </div>

      <main className="flex-1 p-6 flex flex-col max-w-md mx-auto w-full">
        <div className="mb-8 mt-2">
            <h1 className="text-2xl font-bold text-gray-800 mb-1">Seu Progresso</h1>
            <p className="text-gray-500 text-sm">Complete a cartela para ganhar recompensas.</p>
        </div>

        <div className="mb-8">
            <LoyaltyCard card={activeCard} config={config} />
        </div>

        <div className="space-y-4 mt-8">
            <h3 className="font-bold text-gray-700 flex items-center">
                <History className="w-4 h-4 mr-2" /> Histórico Recente
            </h3>
            
            <div className="space-y-2">
                {activeCard.history.slice().reverse().map((event, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-lg border border-gray-100 flex justify-between items-center text-sm shadow-sm">
                        <span className="flex items-center">
                           {event.action === 'STAMP' && <span className="w-2 h-2 rounded-full bg-brand-500 mr-2"></span>}
                           {event.action === 'REDEEM' && <span className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></span>}
                           {event.action === 'CREATED' && <span className="w-2 h-2 rounded-full bg-gray-300 mr-2"></span>}
                           {event.action === 'REMOVED' && <span className="w-2 h-2 rounded-full bg-red-500 mr-2"></span>}
                           
                           {event.action === 'STAMP' ? 'Selo Adicionado' : 
                            event.action === 'REDEEM' ? 'Prêmio Resgatado!' : 
                            event.action === 'REMOVED' ? 'Selo Removido' : 'Cartela Iniciada'}
                        </span>
                        <span className="text-gray-400 text-xs">
                            {new Date(event.date).toLocaleDateString()}
                        </span>
                    </div>
                ))}
                {activeCard.history.length === 0 && (
                    <p className="text-gray-400 text-sm italic">Nenhuma atividade recente.</p>
                )}
            </div>
        </div>
      </main>
      
      {/* Decorative background element */}
      <div className="fixed top-0 left-0 w-full h-64 bg-gradient-to-b from-white to-transparent pointer-events-none -z-0"></div>
    </div>
  );
};
