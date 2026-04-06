import React, { useState, useEffect } from 'react';
import { Box, Container, TextField, Button, Typography, Checkbox, FormControlLabel, Link, Paper, Alert, CircularProgress } from '@mui/material';
import { configService } from '../core/config/configService';
import { t } from '../core/i18n/i18n';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [captcha, setCaptcha] = useState('');
  const [captchaUrl, setCaptchaUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 加载验证码
  const loadCaptcha = async () => {
    try {
      const result = await configService.getCaptcha();
      if (result.data) {
        const url = URL.createObjectURL(result.data);
        setCaptchaUrl(url);
      }
    } catch (err) {
      console.error('Failed to load captcha:', err);
    }
  };

  // 组件挂载时加载验证码
  useEffect(() => {
    loadCaptcha();
  }, []);

  // 处理登录
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await configService.login(username, password, rememberMe, captcha);
      if (result.error) {
        setError(result.error);
        // 重新加载验证码
        loadCaptcha();
      } else {
        // 登录成功，跳转到首页
        window.location.href = '/';
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Typography component="h1" variant="h5" align="center" sx={{ mb: 4 }}>
          {t('login.title')}
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleLogin} noValidate sx={{ mt: 1 }}>
          <TextField
            margin="normal"
            required
            fullWidth
            id="username"
            label={t('login.username')}
            name="username"
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          
          <TextField
            margin="normal"
            required
            fullWidth
            name="password"
            label={t('login.password')}
            type="password"
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', mt: 2, mb: 3 }}>
            <TextField
              required
              fullWidth
              name="captcha"
              label={t('login.captcha')}
              id="captcha"
              value={captcha}
              onChange={(e) => setCaptcha(e.target.value)}
              sx={{ mr: 2 }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              {captchaUrl && (
                <img 
                  src={captchaUrl} 
                  alt="Captcha" 
                  style={{ cursor: 'pointer' }} 
                  onClick={loadCaptcha}
                />
              )}
            </Box>
          </Box>

          <FormControlLabel
            control={<Checkbox value="remember" color="primary" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} />}
            label={t('login.rememberMe')}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : t('login.login')}
          </Button>

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Link href="#" variant="body2">
              {t('login.forgotPassword')}
            </Link>
            <Link href="#" variant="body2">
              {t('login.register')}
            </Link>
          </Box>
        </Box>
      </Paper>
    </Container>
  );
};

export default LoginPage;
