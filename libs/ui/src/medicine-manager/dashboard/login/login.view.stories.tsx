import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { LoginView, type LoginVM } from './login.view';

const meta: Meta<typeof LoginView> = {
  title: 'Medicine Manager/Dashboard/Login',
  component: LoginView,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof LoginView>;

const demo = (over: Partial<LoginVM>) =>
  function Render() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const vm: LoginVM = {
      email,
      password,
      busy: false,
      needsBootstrap: false,
      ...over,
    };
    return (
      <LoginView
        vm={vm}
        onEmail={setEmail}
        onPassword={setPassword}
        onSignIn={(e) => e.preventDefault()}
        onSignUp={(e) => e.preventDefault()}
      />
    );
  };

export const Default: Story = { render: demo({}) };
export const LoadError: Story = {
  render: demo({ error: 'Invalid email or password.' }),
};
export const Busy: Story = { render: demo({ busy: true }) };
export const NeedsBootstrap: Story = { render: demo({ needsBootstrap: true }) };
export const WithNotice: Story = {
  render: demo({
    notice: "This account doesn't have access to the admin dashboard.",
  }),
};
