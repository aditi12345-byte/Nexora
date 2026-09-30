import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Alert from '../components/Alert';
import { useAuth } from '../hooks/useAuth';
import AuthLayout from '../layouts/AuthLayout';
import { errorMessage } from '../services/api';
import { validateRegister } from '../validators/auth';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    const nextErrors = validateRegister(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setPending(true);
    setMessage('');
    try {
      await register(form.name, form.email, form.password);
      navigate('/dashboard');
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      title="Create an account"
      subtitle="Passwords are hashed before they are stored."
      footer={<>Already registered? <Link className="text-moss underline" to="/login">Sign in</Link></>}
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        {message && <Alert>{message}</Alert>}
        {['name', 'email', 'password'].map((field) => (
          <label key={field} className="block text-sm capitalize">
            {field}
            <input
              type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
              className="mt-1 w-full rounded-lg border border-stone-300 px-3 py-2"
              value={form[field]}
              onChange={(event) => update(field, event.target.value)}
            />
            {errors[field] && <span className="text-red-700">{errors[field]}</span>}
          </label>
        ))}
        <button type="submit" disabled={pending} className="w-full rounded-lg bg-moss px-4 py-2 text-white disabled:opacity-60">
          {pending ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
}
