import React, { useState } from 'react';

interface PermissionCardProps {
  toolName: string;
  description: string;
  purpose: string;
}

export const PermissionCard: React.FC<PermissionCardProps> = ({ toolName, description, purpose }) => {
  const [decision, setDecision] = useState<'approve' | 'cancel' | null>(null);

  const handleApprove = () => {
    setDecision('approve');
    window.dispatchEvent(new CustomEvent('mcp-permission', { detail: 'approve' }));
  };

  const handleCancel = () => {
    setDecision('cancel');
    window.dispatchEvent(new CustomEvent('mcp-permission', { detail: 'cancel' }));
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: '12px',
      padding: '24px',
      color: 'white',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
      margin: '16px 0'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.2)',
          borderRadius: '50%',
          width: '48px',
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: '16px'
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7V12C2 16.55 4.84 20.74 9 22.05V19.77C6.2 18.63 4.5 15.58 4.5 12V8.3L12 4.65L19.5 8.3V12C19.5 12.63 19.38 13.23 19.2 13.79L21.26 15.85C21.73 14.64 22 13.34 22 12V7L12 2M18 14C17.87 14 17.76 14.09 17.74 14.21L17.55 15.53C17.25 15.66 16.96 15.82 16.7 16L15.46 15.5C15.35 15.5 15.22 15.5 15.15 15.63L14.15 17.36C14.09 17.47 14.11 17.6 14.21 17.68L15.27 18.5C15.25 18.67 15.24 18.83 15.24 19C15.24 19.17 15.25 19.33 15.27 19.5L14.21 20.32C14.12 20.4 14.09 20.53 14.15 20.64L15.15 22.37C15.21 22.5 15.34 22.5 15.46 22.5L16.7 22C16.96 22.18 17.24 22.35 17.55 22.47L17.74 23.79C17.76 23.91 17.86 24 18 24H20C20.11 24 20.22 23.91 20.25 23.79L20.44 22.47C20.74 22.34 21 22.18 21.27 22L22.5 22.5C22.61 22.5 22.74 22.5 22.81 22.37L23.81 20.64C23.87 20.53 23.85 20.4 23.75 20.32L22.69 19.5C22.71 19.33 22.72 19.17 22.72 19C22.72 18.83 22.71 18.67 22.69 18.5L23.75 17.68C23.84 17.6 23.87 17.47 23.81 17.36L22.81 15.63C22.75 15.5 22.62 15.5 22.5 15.5L21.27 16C21 15.82 20.75 15.66 20.44 15.53L20.25 14.21C20.22 14.09 20.11 14 20 14H18M19 17.5C19.83 17.5 20.5 18.17 20.5 19C20.5 19.83 19.83 20.5 19 20.5C18.16 20.5 17.5 19.83 17.5 19C17.5 18.17 18.17 17.5 19 17.5Z" fill="currentColor"/>
          </svg>
        </div>
        <h3 style={{ margin: 0, fontSize: '24px', fontWeight: 600 }}>MCP Tool Request</h3>
      </div>
      
      <div style={{
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '16px'
      }}>
        <p style={{ margin: '0 0 8px 0', opacity: 0.9, fontSize: '14px' }}>
          I'd like to use the following tool:
        </p>
        <p style={{ margin: 0, fontSize: '18px', fontWeight: 500 }}>🔧 {toolName}</p>
        <p style={{ margin: '8px 0 0 0', opacity: 0.8, fontSize: '14px' }}>{description}</p>
      </div>
      
      <div style={{
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '20px'
      }}>
        <p style={{ margin: '0 0 8px 0', fontWeight: 500, fontSize: '16px' }}>Purpose:</p>
        <p style={{ margin: 0, opacity: 0.9, lineHeight: 1.5 }}>{purpose}</p>
      </div>
      
      {decision ? (
        // Show decision result
        <div style={{
          background: decision === 'approve' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
          borderRadius: '8px',
          padding: '16px',
          textAlign: 'center'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '20px' }}>
              {decision === 'approve' ? '✅' : '❌'}
            </span>
            <span style={{ fontSize: '16px', fontWeight: 600 }}>
              User {decision === 'approve' ? 'Approved' : 'Cancelled'}
            </span>
          </div>
          <p style={{ margin: '8px 0 0 0', opacity: 0.9, fontSize: '14px' }}>
            {decision === 'approve' 
              ? 'Tool execution proceeding...'
              : 'Tool execution cancelled by user'
            }
          </p>
        </div>
      ) : (
        // Show buttons for decision
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center'
        }}>
          <button 
            onClick={handleCancel}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '2px solid rgba(255,255,255,0.3)',
              borderRadius: '8px',
              padding: '12px 24px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s',
              color: 'white',
              fontSize: '16px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          >
            ❌ Cancel
          </button>
          <button 
            onClick={handleApprove}
            style={{
              background: 'rgba(255,255,255,0.9)',
              color: '#667eea',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontSize: '16px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.9)'}
          >
            ✅ Approve
          </button>
        </div>
      )}
    </div>
  );
};