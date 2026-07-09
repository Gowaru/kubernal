import { test, expect } from '@playwright/test';

const mockUser = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'admin@kubernal.io',
  name: 'Admin User',
  role: 'admin',
  teamId: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('displays login form elements', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Connexion' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Mot de passe' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
    await expect(page.getByLabel('Se souvenir de moi')).toBeVisible();
  });

  test('shows GitHub SSO button', async ({ page }) => {
    await expect(page.getByRole('link', { name: /GitHub/ })).toBeVisible();
  });

  test('native browser validation blocks invalid email', async ({ page }) => {
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByRole('textbox', { name: 'Mot de passe' }).fill('password');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows error on failed login', async ({ page }) => {
    await page.route('**/api/auth/login', (route) => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' },
        }),
      });
    });

    await page.getByLabel('Email').fill('wrong@test.com');
    await page.getByRole('textbox', { name: 'Mot de passe' }).fill('wrong');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByText('Invalid email or password').first()).toBeVisible();
  });

  test('redirects to dashboard on successful login', async ({ page }) => {
    await page.route('**/api/auth/login', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockUser }),
      });
    });
    await page.route('**/api/auth/me', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: mockUser }),
      });
    });

    await page.getByLabel('Email').fill('admin@kubernal.io');
    await page.getByRole('textbox', { name: 'Mot de passe' }).fill('changeme');
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL('/');
  });

  test('displays session expired message', async ({ page }) => {
    await page.goto('/login?expired=true');
    await expect(page.getByText('Session expirée').first()).toBeVisible();
  });

  test('displays OIDC error message', async ({ page }) => {
    await page.goto('/login?error=SSO+login+failed');
    await expect(page.getByText('SSO login failed').first()).toBeVisible();
  });

  test('toggle password visibility', async ({ page }) => {
    const passwordInput = page.getByRole('textbox', { name: 'Mot de passe' });
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: /Afficher/ }).click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
  });
});
