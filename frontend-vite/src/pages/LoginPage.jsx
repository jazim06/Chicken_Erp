import React from 'react';
import { LoginCard } from '../components/LoginCard';

const LoginPage = () => {
  return (
    <div className="min-h-screen login-background flex items-center justify-center p-4">
      <div className="relative z-10 w-full flex items-center justify-center">
        <LoginCard />
      </div>
    </div>
  );
};

export default LoginPage;
