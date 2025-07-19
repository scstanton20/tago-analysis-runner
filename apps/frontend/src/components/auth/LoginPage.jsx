import { useState, useEffect } from 'react';
import {
  TextInput,
  PasswordInput,
  Button,
  Title,
  Text,
  Box,
  Stack,
  Alert,
  Container,
  Card,
  Divider,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconLogin,
  IconFingerprint,
} from '@tabler/icons-react';
import { signIn, signInPasskey } from '../../lib/auth.js';
import { useNotifications } from '../../hooks/useNotifications.jsx';
import Logo from '../logo';

export default function LoginPage() {
  const notify = useNotifications();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [error, setError] = useState('');
  const [isWebAuthnSupported, setIsWebAuthnSupported] = useState(false);

  // Handle password manager autofill
  useEffect(() => {
    const handleAutofill = () => {
      // Small delay to allow password managers to fill fields
      setTimeout(() => {
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');

        if (
          usernameInput &&
          usernameInput.value &&
          usernameInput.value !== formData.username
        ) {
          setFormData((prev) => ({ ...prev, username: usernameInput.value }));
        }
        if (
          passwordInput &&
          passwordInput.value &&
          passwordInput.value !== formData.password
        ) {
          setFormData((prev) => ({ ...prev, password: passwordInput.value }));
        }
      }, 100);
    };

    // Listen for autofill events
    document.addEventListener('DOMContentLoaded', handleAutofill);
    window.addEventListener('load', handleAutofill);

    // Also check periodically for the first few seconds
    const interval = setInterval(handleAutofill, 500);
    setTimeout(() => clearInterval(interval), 3000);

    return () => {
      document.removeEventListener('DOMContentLoaded', handleAutofill);
      window.removeEventListener('load', handleAutofill);
      clearInterval(interval);
    };
  }, [formData.username, formData.password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.username || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Determine if input is email or username
      const isEmail = formData.username.includes('@');

      let result;
      if (isEmail) {
        result = await signIn.email({
          email: formData.username,
          password: formData.password,
        });
      } else {
        result = await signIn.username({
          username: formData.username,
          password: formData.password,
        });
      }

      if (result.error) {
        throw new Error(result.error.message);
      }

      // Show success notification - Better Auth will handle the redirect automatically
      notify.success('Welcome back! You have been signed in successfully.');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  };

  // Check WebAuthn support on component mount
  useEffect(() => {
    const checkSupport = () => {
      // Basic WebAuthn support check
      const supported = !!(
        window.PublicKeyCredential &&
        window.navigator.credentials &&
        window.navigator.credentials.create &&
        window.navigator.credentials.get
      );
      setIsWebAuthnSupported(supported);
    };
    checkSupport();
  }, []);

  const handlePasskeyLogin = async () => {
    setPasskeyLoading(true);
    setError('');

    try {
      const result = await signInPasskey();

      // Better Auth may return result directly or in a different format
      if (result && result.error) {
        throw new Error(
          result.error.message || 'Passkey authentication failed',
        );
      }

      // Show success notification and trigger auth refresh
      notify.success('Welcome back! You have been signed in successfully.');

      // Force refresh session to update UI
      window.dispatchEvent(new Event('auth-change'));
    } catch (err) {
      console.error('Passkey login error:', err);
      setError(err.message || 'Passkey authentication failed');
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <Container size="xs" style={{ minHeight: '100vh' }}>
      <Box
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem 0',
        }}
      >
        <Card
          shadow="xl"
          padding="xl"
          radius="lg"
          style={{
            width: '100%',
            maxWidth: 400,
            background: 'var(--mantine-color-body)',
            border: '1px solid var(--mantine-color-gray-3)',
          }}
        >
          <form onSubmit={handleSubmit}>
            <Stack gap="lg">
              <Box ta="center">
                <Logo size={104} />
                <Title
                  order={2}
                  ta="center"
                  mt="md"
                  mb="xs"
                  style={{
                    fontWeight: 800,
                    background:
                      'linear-gradient(45deg, var(--mantine-color-brand-6), var(--mantine-color-accent-6))',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  Tago Analysis Runner
                </Title>
                <Text size="sm" c="dimmed" ta="center">
                  Sign in to your account
                </Text>
              </Box>

              {error && (
                <Alert
                  icon={<IconAlertCircle size="1rem" />}
                  color="red"
                  variant="light"
                  radius="md"
                >
                  {error}
                </Alert>
              )}

              <Stack gap="md" key="login-form-fields">
                <TextInput
                  label="Email or Username"
                  placeholder="Enter your email or username"
                  value={formData.username}
                  onChange={(e) =>
                    handleInputChange('username', e.target.value)
                  }
                  required
                  size="md"
                  autoComplete="username"
                  name="username"
                  id="username"
                  description="You can sign in with either your email address or username"
                />

                <PasswordInput
                  label="Password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) =>
                    handleInputChange('password', e.target.value)
                  }
                  required
                  size="md"
                  autoComplete="current-password"
                  name="password"
                  id="password"
                />
              </Stack>

              <Button
                type="submit"
                loading={loading}
                fullWidth
                size="md"
                leftSection={<IconLogin size="1rem" />}
                variant="gradient"
                gradient={{ from: 'brand.6', to: 'accent.6' }}
                radius="md"
                style={{
                  fontWeight: 600,
                }}
                disabled={passkeyLoading}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>

              {isWebAuthnSupported && (
                <>
                  <Divider label="OR" labelPosition="center" />

                  <Button
                    onClick={handlePasskeyLogin}
                    loading={passkeyLoading}
                    fullWidth
                    size="md"
                    leftSection={<IconFingerprint size="1rem" />}
                    variant="light"
                    color="blue"
                    radius="md"
                    style={{
                      fontWeight: 600,
                    }}
                    disabled={loading}
                  >
                    {passkeyLoading
                      ? 'Authenticating...'
                      : 'Sign in with Passkey'}
                  </Button>

                  <Text size="xs" c="dimmed" ta="center">
                    Use Face ID, Touch ID, Windows Hello, or your security key
                  </Text>
                </>
              )}
            </Stack>
          </form>
        </Card>
      </Box>
    </Container>
  );
}
