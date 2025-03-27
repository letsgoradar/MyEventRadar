import React from 'react';
import { LoginForm } from '@/components/Auth/LoginForm';

const AdminLogin: React.FC = () => {
  return (
    <div className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <LoginForm redirectPath="/admin" />
      </div>
    </div>
  );
};

export default AdminLogin;