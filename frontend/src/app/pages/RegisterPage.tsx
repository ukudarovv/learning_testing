import { Header } from '../components/Header';
import { RegisterForm } from '../components/RegisterForm';
import { SiteFooter } from '../components/SiteFooter';

export function RegisterPage() {
  return (
    <>
      <Header />
      <main className="pt-20">
        <RegisterForm />
      </main>
      <SiteFooter />
    </>
  );
}
