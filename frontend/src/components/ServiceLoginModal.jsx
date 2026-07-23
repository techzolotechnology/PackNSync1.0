import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { ridesApi } from '../api/index.js';
import './ServiceLoginModal.css';

const SERVICE_META = {
    UBER: { name: 'Uber', color: '#000000', icon: 'U', note: 'OAuth ride estimates and booking after Uber approval' },
    OLA: { name: 'Ola', color: '#BDE32B', icon: 'O', note: 'Requires Ola partner app token and booking approval' },
    RAPIDO: { name: 'Rapido', color: '#FFD100', icon: 'R', note: 'Requires Rapido partner API access' },
    ZOOMCAR: { name: 'Zoomcar', color: '#10B981', icon: 'Z', note: 'Requires Zoomcar partner API access for self-drive rentals' },
};

export default function ServiceLoginModal({ isOpen, onClose, onConnected, linkedProviders }) {
    const [providers, setProviders] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [uberRedirectUri, setUberRedirectUri] = useState('');
    const [uberScopeHelp, setUberScopeHelp] = useState('');

    useEffect(() => {
        if (!isOpen) return;

        const loadProviders = async () => {
            setIsLoading(true);
            try {
                const [res, setupRes] = await Promise.all([
                    ridesApi.getProviders(),
                    ridesApi.getUberSetup().catch(() => null),
                ]);
                setProviders(res.data.data);
                setUberRedirectUri(setupRes?.data?.data?.redirectUri || '');
                setUberScopeHelp(setupRes?.data?.data?.invalidScopeHelp || '');
            } catch (err) {
                toast.error(err.response?.data?.message || 'Unable to load provider status.');
            } finally {
                setIsLoading(false);
            }
        };

        loadProviders();
    }, [isOpen]);

    useEffect(() => {
        const handleMessage = (event) => {
            if (event.data?.type === 'UBER_CONNECTED') {
                toast.success('Uber connected successfully.');
                onConnected('UBER');
                onClose();
            }
            if (event.data?.type === 'UBER_FAILED') {
                const reason = event.data.reason || 'Check Uber Dashboard redirect URI and try again.';
                toast.error(`Uber failed: ${reason}`, { duration: 6000 });
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [onClose, onConnected]);

    const handleConnect = async (provider) => {
        setIsLoading(true);
        try {
            const res = await ridesApi.linkAccount({ provider: provider.provider });
            if (res.data.redirectUrl) {
                const width = 520;
                const height = 680;
                const left = (window.innerWidth - width) / 2;
                const top = (window.innerHeight - height) / 2;
                window.open(res.data.redirectUrl, `${provider.provider} Login`, `width=${width},height=${height},top=${top},left=${left}`);
            }
        } catch (err) {
            toast.error(err.response?.data?.message || 'Provider connection is not available.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
                <div className="fadeIn">
                    <div className="modal-header">
                        <h2>Connect Real Providers</h2>
                        <button className="close-btn" onClick={onClose}>&times;</button>
                    </div>
                    <p className="modal-subtitle">
                        Provider app-password and OTP login are not supported. Real comparison and booking require official provider credentials and approved API access.
                    </p>
                    {uberRedirectUri && (
                        <p className="uber-setup-hint">
                            <strong>Uber setup</strong><br />
                            1. Redirect URI: <code>{uberRedirectUri}</code><br />
                            2. In Uber Dashboard → Setup → enable scopes for your app<br />
                            {uberScopeHelp && <span>{uberScopeHelp}</span>}
                        </p>
                    )}

                    <div className="service-list">
                        {isLoading && providers.length === 0 ? (
                            <div className="service-item card">Loading providers...</div>
                        ) : providers.map((provider) => {
                            const meta = SERVICE_META[provider.provider] || {};
                            const isLinked = linkedProviders.includes(provider.provider);
                            const canConnect = provider.isConfigured && provider.provider === 'UBER';

                            return (
                                <div key={provider.provider} className="service-item card">
                                    <div className="service-icon" style={{ backgroundColor: meta.color }}>{meta.icon || provider.provider[0]}</div>
                                    <div className="service-info">
                                        <h3>{meta.name || provider.provider}</h3>
                                        <span>{provider.isConfigured ? meta.note : provider.setup}</span>
                                    </div>
                                    <button
                                        className={`btn ${isLinked ? 'btn-ghost' : 'btn-primary'} btn-sm`}
                                        onClick={() => handleConnect(provider)}
                                        disabled={isLoading || isLinked || !canConnect}
                                        title={!canConnect && !isLinked ? provider.setup : undefined}
                                    >
                                        {isLinked ? 'Connected' : canConnect ? 'Connect' : 'Needs Setup'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>

                    <button className="btn btn-accent" style={{ width: '100%', marginTop: '1.5rem' }} onClick={onClose}>Done</button>
                </div>
            </div>
        </div>
    );
}
