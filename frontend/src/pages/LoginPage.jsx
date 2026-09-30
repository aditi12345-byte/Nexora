import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Alert from '../components/Alert';
import { useAuth } from '../hooks/useAuth';
import AuthLayout from '../layouts/AuthLayout';
import { errorMessage } from '../services/api';
import { validateLogin } from '../validators/auth';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    const nextErrors = validateLogin(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setPending(true);
    setMessage('');
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Use the account you created for this workspace."
      footer={<>New to Folio? <Link className="text-moss underline" to="/register">Create an account</Link></>}
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        {message && <Alert>{message}</Alert>}
        <label className="block text-sm">
          Email
          <input className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          {errors.email && <span className="text-red-700">{errors.email}</span>}
        </label>
        <label className="block text-sm">
          Password
          <input type="password" className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          {errors.password && <span className="text-red-700">{errors.password}</span>}
        </label>
        <button type="submit" disabled={pending} className="w-full rounded-lg bg-moss px-4 py-2 text-white disabled:opacity-60">
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  );
}
