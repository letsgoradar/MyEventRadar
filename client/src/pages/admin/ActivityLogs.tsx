import React from 'react';
import AdminNav from '@/components/Layout/AdminNav';

const ActivityLogs: React.FC = () => {
  return (
    <div className="h-screen flex flex-col">
      <AdminNav />
      <div className="flex-1 p-6 overflow-auto">
        <h1 className="text-3xl font-bold mb-6">Activiteitslogboek</h1>
        <p className="text-muted-foreground">
          Hier komen de functies voor het bekijken van gebruikersactiviteiten in het systeem.
        </p>
      </div>
    </div>
  );
};

export default ActivityLogs;