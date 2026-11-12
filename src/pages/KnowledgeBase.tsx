import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, Search } from 'lucide-react';
import { brand } from '../config/brand';
import { SiteFooter } from '../components/SiteFooter';
import { SiteNav } from '../components/SiteNav';
import { SkyBanner } from '../components/SkyBanner';
import {
  getKbArticle,
  KB_ARTICLES,
  KB_CATEGORIES,
  kbCategoryLabel,
  searchKbArticles,
  type KbArticle,
  type KbCategoryId,
} from '../lib/knowledgeBase';

type CategoryFilter = KbCategoryId | 'all';

export default function KnowledgeBase() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const article = slug ? getKbArticle(slug) : undefined;
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');

  useEffect(() => {
    if (slug && !article) {
      document.title = `Not found · Knowledge base · ${brand.name}`;
      return;
    }
    document.title = article
      ? `${article.title} · Knowledge base · ${brand.name}`
      : `Knowledge base · ${brand.name}`;
  }, [article, slug]);

  useEffect(() => {
    if (slug && !article) navigate('/knowledge', { replace: true });
  }, [slug, article, navigate]);

  const results = useMemo(() => searchKbArticles(query, category), [query, category]);

  return (
    <div className="public-shell">
      <div className="landing-top">
        <SiteNav current="knowledge" />
      </div>
      <main id="main">
        <SkyBanner className="legal-banner kb-banner">
          <header className="legal-head">
            <span className="eyebrow">Help</span>
            <h1 className="display">{article ? article.title : 'Knowledge base'}</h1>
            <p className="legal-updated">
              {article ? kbCategoryLabel(article.category) : `Guides to every corner of ${brand.name}`}
            </p>
          </header>
        </SkyBanner>

        <div className="public-content kb-content">
          {article ? <ArticleView article={article} /> : <BrowseView query={query} setQuery={setQuery} category={category} setCategory={setCategory} results={results} />}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function BrowseView({
  query,
  setQuery,
  category,
  setCategory,
  results,
}: {
  query: string;
  setQuery: (v: string) => void;
  category: CategoryFilter;
  setCategory: (v: CategoryFilter) => void;
  results: KbArticle[];
}) {
  return (
    <div className="kb-browse">
      <label className="kb-search">
        <Search size={18} aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search features, sharing, boxes…"
          aria-label="Search the knowledge base"
        />
      </label>

      <div className="kb-filters" role="tablist" aria-label="Categories">
        <button type="button" role="tab" aria-selected={category === 'all'} className={`kb-filter${category === 'all' ? ' is-active' : ''}`} onClick={() => setCategory('all')}>
          All
        </button>
        {KB_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={category === c.id}
            className={`kb-filter${category === c.id ? ' is-active' : ''}`}
            onClick={() => setCategory(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <p className="kb-count muted text-sm">
        {results.length === KB_ARTICLES.length
          ? `${results.length} articles`
          : `${results.length} result${results.length === 1 ? '' : 's'}`}
      </p>

      {results.length === 0 ? (
        <div className="kb-empty">
          <BookOpen size={28} aria-hidden />
          <p>No articles match that search. Try another word, or clear the filters.</p>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setQuery('');
              setCategory('all');
            }}
          >
            Clear search
          </button>
        </div>
      ) : (
        <ul className="kb-article-list">
          {results.map((a) => (
            <li key={a.slug}>
              <Link to={`/knowledge/${a.slug}`} className="kb-article-card">
                <span className="kb-article-cat">{kbCategoryLabel(a.category)}</span>
                <strong className="kb-article-title">{a.title}</strong>
                <span className="kb-article-summary">{a.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ArticleView({ article }: { article: KbArticle }) {
  return (
    <article className="kb-article legal">
      <Link to="/knowledge" className="kb-back">
        <ArrowLeft size={16} aria-hidden />
        All articles
      </Link>
      <p className="legal-lead">{article.summary}</p>
      {article.sections.map((section, i) => (
        <section key={i}>
          {section.heading ? <h2>{section.heading}</h2> : null}
          {section.paragraphs.map((p, j) => (
            <p key={j}>{p}</p>
          ))}
        </section>
      ))}
      <nav className="kb-related" aria-label="More in this topic">
        <h2>More in {kbCategoryLabel(article.category)}</h2>
        <ul>
          {KB_ARTICLES.filter((a) => a.category === article.category && a.slug !== article.slug)
            .slice(0, 4)
            .map((a) => (
              <li key={a.slug}>
                <Link to={`/knowledge/${a.slug}`}>{a.title}</Link>
              </li>
            ))}
        </ul>
      </nav>
    </article>
  );
}
