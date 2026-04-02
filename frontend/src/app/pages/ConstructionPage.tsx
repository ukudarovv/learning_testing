import { Header } from '../components/Header';
import { Projects } from '../components/Projects';
import { SiteFooter } from '../components/SiteFooter';

export function ConstructionPage() {
  return (
    <>
      <Header />
      <main className="pt-20">
        <div className="container mx-auto px-4 py-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Строительное направление</h1>
          <p className="text-lg text-gray-600 mb-12 max-w-3xl">
            Просмотрите наши выполненные проекты и ознакомьтесь с опытом нашей команды в сфере проектно-строительных работ.
          </p>
        </div>
        <Projects />
      </main>
      <SiteFooter />
    </>
  );
}