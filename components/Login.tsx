
import React, { useState, useEffect } from 'react';
import { UserRole, LoyaltyConfig } from '../types';
import { StorageService } from '../services/storageService';
import { Button, Input, Card } from './ui/Shared';
import { Store, UserCircle, Lock, Mail, Phone, User as UserIcon } from 'lucide-react';

export const Login: React.FC = () => {
  const [role, setRole] = useState<UserRole>(UserRole.CUSTOMER);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [config, setConfig] = useState<LoyaltyConfig | null>(null);
  
  // Registration State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Load config to display Logo if available
    const unsubscribe = StorageService.subscribeToConfig((c) => setConfig(c));
    return () => unsubscribe();
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    
    if (!email) {
        setError('Digite seu email para recuperar a senha.');
        return;
    }

    setLoading(true);
    try {
        await StorageService.resetPassword(email);
        setSuccessMessage('Email de recuperação enviado! Verifique sua caixa de entrada.');
        setTimeout(() => setResetMode(false), 5000);
    } catch (err: any) {
        console.error(err);
        const msg = err.message || '';
        if (msg.toLowerCase().includes('rate limit')) {
            setError('Muitas solicitações de recuperação. Aguarde alguns minutos.');
        } else {
            setError('Erro ao enviar email de recuperação. Verifique o email digitado.');
        }
    } finally {
        setLoading(false);
    }
  };

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    if (!email || !password) {
        setError('Preencha email e senha.');
        setLoading(false);
        return;
    }

    try {
        if (isRegistering && role === UserRole.CUSTOMER) {
             if (!name || !phone) {
                 setError('Preencha todos os campos.');
                 setLoading(false);
                 return;
             }
             await StorageService.register(name, email, phone, password, UserRole.CUSTOMER);
             // Auth listener in App.tsx will redirect
        } else {
             // Login Logic
             await StorageService.login(email, password);
             // Note: User role validation happens after login in App.tsx or here if we want strictly
             // Since Firebase Auth doesn't return custom fields immediately in the User object without fetching,
             // we let the App.tsx listener handle the "Successful Login" state.
        }
    } catch (err: any) {
        console.error('Login Error:', err);
        const errorMessage = err.message || '';
        const errorCode = err.code || '';

        if (
            errorCode === 'auth/invalid-credential' || 
            errorCode === 'auth/user-not-found' || 
            errorCode === 'auth/wrong-password' ||
            errorCode === 'auth/invalid-login-credentials' ||
            errorMessage.toLowerCase().includes('invalid login credentials')
        ) {
             // If customer fails login, suggest registration
             if (role === UserRole.CUSTOMER && !isRegistering) {
                 setError('Conta não encontrada. Deseja criar?');
                 setIsRegistering(true);
             } else {
                 setError('Email ou senha inválidos.');
             }
        } else if (errorCode === 'auth/email-already-in-use') {
             setError('Este email já está cadastrado.');
        } else if (errorCode === 'auth/weak-password') {
             setError('A senha deve ter pelo menos 6 caracteres.');
        } else if (errorMessage.toLowerCase().includes('rate limit')) {
            setError('Muitas solicitações seguidas. Aguarde alguns minutos antes de tentar novamente.');
        } else {
            setError(errorMessage || 'Erro ao entrar. Tente novamente.');
        }
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-brand-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 flex flex-col items-center">
            {config?.logo ? (
                <img src={config.logo} alt={config.businessName} className="h-24 object-contain mb-4 animate-fade-in" />
            ) : (
                <h1 className="text-3xl font-bold text-brand-900 mb-2">{config?.businessName || 'FidelizaAI'}</h1>
            )}
            <p className="text-brand-600">Seu programa de fidelidade inteligente.</p>
        </div>

        <Card className="border-t-4 border-brand-500 shadow-xl">
          {!resetMode ? (
            <>
              <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-lg">
                <button
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${role === UserRole.CUSTOMER ? 'bg-white shadow text-brand-700' : 'text-gray-500 hover:text-gray-700'}`}
                  onClick={() => { setRole(UserRole.CUSTOMER); setError(''); setIsRegistering(false); }}
                >
                   <UserCircle className="inline w-4 h-4 mr-1"/> Sou Cliente
                </button>
                <button
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${role === UserRole.ADMIN ? 'bg-white shadow text-brand-700' : 'text-gray-500 hover:text-gray-700'}`}
                  onClick={() => { setRole(UserRole.ADMIN); setError(''); setIsRegistering(false); }}
                >
                   <Store className="inline w-4 h-4 mr-1"/> Sou Lojista
                </button>
              </div>

              <form onSubmit={handleAction} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                    <Input 
                        type="email" 
                        placeholder="seu@email.com" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide">Senha</label>
                    <button 
                      type="button" 
                      onClick={() => { setResetMode(true); setError(''); setSuccessMessage(''); }}
                      className="text-[10px] font-bold text-brand-600 hover:underline uppercase tracking-wider"
                    >
                      Esqueci a senha
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                    <Input 
                        type="password" 
                        placeholder="******" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10"
                    />
                  </div>
                </div>

                {isRegistering && role === UserRole.CUSTOMER && (
                   <div className="animate-fade-in space-y-4 pt-4 border-t border-gray-100 mt-4">
                     <div className="flex items-center justify-between">
                        <p className="text-sm text-brand-600 font-bold">Criar nova conta</p>
                        <span className="text-xs text-gray-400">Preencha seus dados</span>
                     </div>
                     
                     <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Nome Completo</label>
                        <div className="relative">
                            <UserIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                            <Input 
                                placeholder="João Silva" 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                     </div>
                     <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Celular</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                            <Input 
                                placeholder="(11) 99999-9999" 
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                     </div>
                   </div>
                )}

                {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded border border-red-100">{error}</p>}
                {successMessage && <p className="text-green-600 text-sm bg-green-50 p-2 rounded border border-green-100">{successMessage}</p>}

                <Button type="submit" className="w-full mt-4 h-11 text-lg" isLoading={loading}>
                  {role === UserRole.ADMIN ? 'Entrar no Painel' : isRegistering ? 'Cadastrar e Entrar' : 'Acessar Cartão'}
                </Button>
              </form>
              
              {role === UserRole.ADMIN && (
                  <p className="mt-4 text-xs text-center text-gray-400">
                      Acesso restrito para equipe e gestão.
                  </p>
              )}
              
              {!isRegistering && role === UserRole.CUSTOMER && (
                 <p className="mt-4 text-sm text-center">
                     Ainda não tem conta? 
                     <button onClick={() => setIsRegistering(true)} className="ml-1 text-brand-600 font-bold hover:underline">Cadastre-se</button>
                 </p>
              )}
              {isRegistering && (
                  <p className="mt-4 text-sm text-center">
                     Já tem conta? 
                     <button onClick={() => setIsRegistering(false)} className="ml-1 text-brand-600 font-bold hover:underline">Entrar</button>
                 </p>
              )}
            </>
          ) : (
            <div className="animate-fade-in">
              <h2 className="text-xl font-bold text-gray-800 mb-2">Recuperar Senha</h2>
              <p className="text-sm text-gray-600 mb-6">
                Enviaremos um link de recuperação para o email abaixo.
              </p>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Seu Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                    <Input 
                        type="email" 
                        placeholder="seu@email.com" 
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                    />
                  </div>
                </div>

                {error && <p className="text-red-500 text-sm bg-red-50 p-2 rounded border border-red-100">{error}</p>}
                {successMessage && <p className="text-green-600 text-sm bg-green-50 p-2 rounded border border-green-100">{successMessage}</p>}

                <Button type="submit" className="w-full h-11 text-lg" isLoading={loading} disabled={!!successMessage}>
                  Enviar Link
                </Button>
                
                <button 
                  type="button" 
                  onClick={() => { setResetMode(false); setError(''); setSuccessMessage(''); }}
                  className="w-full text-sm text-gray-500 hover:text-brand-600 transition-colors font-medium"
                >
                  Voltar para o Login
                </button>
              </form>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
