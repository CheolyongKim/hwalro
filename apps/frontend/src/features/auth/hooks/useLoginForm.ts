import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/getErrorMessage';

export function useLoginForm() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const loginMutation = useMutation({
    mutationFn: () => login(loginId, password, rememberMe),
    onSuccess: () => navigate('/', { replace: true }),
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    loginMutation.mutate();
  };

  return {
    loginId,
    setLoginId,
    password,
    setPassword,
    rememberMe,
    setRememberMe,
    isPending: loginMutation.isPending,
    errorMessage: loginMutation.isError ? getErrorMessage(loginMutation.error) : null,
    handleSubmit,
  };
}
