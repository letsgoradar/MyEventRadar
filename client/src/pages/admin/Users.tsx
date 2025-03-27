import React from 'react';
import AdminNav from '@/components/Layout/AdminNav';

const AdminUsers: React.FC = () => {
  return (
    <div className="h-screen flex flex-col">
      <AdminNav />
      <div className="flex-1 p-6 overflow-auto">
        <h1 className="text-3xl font-bold mb-6">Gebruikers Beheer</h1>
        <p className="text-muted-foreground">
          Hier komen de functies voor het beheren van gebruikers.
        </p>
      </div>
    </div>
  );
};

export default AdminUsers;