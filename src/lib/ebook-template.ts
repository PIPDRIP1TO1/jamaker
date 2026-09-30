import type { EbookProject, EbookRecipe as Recipe } from "@/lib/ebook-types";

export function renderEbookHTML(project: EbookProject): string {
  const {
    title,
    subtitle,
    author,
    brandName,
    language = 'en',
    theme,
    accentColor,
    coverImage,
    backCoverImage,
    useCustomFrontCover = false,
    useCustomBackCover = false,
    introTitle,
    introText,
    backCoverText,
    backCoverAuthorBio,
    socialLinks,
    recipes: rawRecipes,
    selectedCategories,
  } = project;

  const isEn = language === 'en';

  // Filter recipes by selectedCategories if specified
  const filteredRawRecipes = Array.isArray(selectedCategories) && selectedCategories.length > 0
    ? rawRecipes.filter((r) => selectedCategories.includes(r.category || (isEn ? 'General Recipes' : 'Recettes Diverses')))
    : rawRecipes;

  // Group and sort recipes by category so recipes of the same category are together
  const categoryOrder: string[] = [];
  const categoriesMap: Record<string, Recipe[]> = {};

  filteredRawRecipes.forEach((r) => {
    const cat = r.category || (isEn ? 'General Recipes' : 'Recettes Diverses');
    if (!categoriesMap[cat]) {
      categoriesMap[cat] = [];
      categoryOrder.push(cat);
    }
    categoriesMap[cat].push(r);
  });

  // Flat sorted recipes list grouped by category
  const sortedRecipes: Recipe[] = [];
  categoryOrder.forEach((cat) => {
    sortedRecipes.push(...categoriesMap[cat]);
  });

  // Map each recipe ID to its final page number
  const recipePageNumbers: Record<string, number> = {};
  sortedRecipes.forEach((r, idx) => {
    recipePageNumbers[r.id] = idx + 4; // Page 1 = Cover, Page 2 = Intro, Page 3 = TOC
  });

  // Theme color maps
  const colorMap: Record<string, { bg: string; text: string; lightBg: string; border: string }> = {
    gourmet: { bg: '#c2410c', text: '#9a3412', lightBg: '#fff7ed', border: '#ffedd5' },
    minimal: { bg: '#0f172a', text: '#1e293b', lightBg: '#f8fafc', border: '#e2e8f0' },
    rustic: { bg: '#78350f', text: '#451a03', lightBg: '#fef3c7', border: '#fde68a' },
    vibrant: { bg: '#0d9488', text: '#0f766e', lightBg: '#ccfbf1', border: '#99f6e4' },
  };

  const currentTheme = colorMap[theme] || colorMap.gourmet;
  const primaryColor = accentColor || currentTheme.bg;

  // Dictionary
  const labels = {
    brand: brandName || (isEn ? 'GOURMET EDITION' : 'ÉDITION GOURMANDE'),
    badge: isEn ? `${sortedRecipes.length} Tested & Proven Recipes` : `${sortedRecipes.length} Recettes Inratables`,
    by: isEn ? 'By' : 'Par',
    defaultAuthor: isEn ? 'Chef Gourmet' : 'Chef Gourmet',
    intro: isEn ? 'Introduction' : 'Introduction',
    toc: isEn ? 'Table of Contents' : 'Sommaire',
    prep: isEn ? 'Prep:' : 'Préparation :',
    cook: isEn ? 'Cook:' : 'Cuisson :',
    servings: isEn ? 'Servings:' : 'Portions :',
    ingredients: isEn ? 'Ingredients' : 'Ingrédients',
    steps: isEn ? 'Step-by-Step Instructions' : 'Étapes de Préparation',
    chefTip: isEn ? "Chef's Tip:" : "Astuce du Chef :",
    aboutAuthor: isEn ? 'About the Author' : "À Propos de l'Auteur",
    rights: isEn ? 'All rights reserved.' : 'Tous droits réservés.',
    page: isEn ? 'Page' : 'Page',
  };

  return `
<!DOCTYPE html>
<html lang="${isEn ? 'en' : 'fr'}">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      margin: 0;
      padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #1e293b;
      background: #ffffff;
      font-size: 13px;
      line-height: 1.5;
    }

    .page {
      width: 210mm;
      height: 297mm;
      position: relative;
      page-break-after: always;
      page-break-inside: avoid;
      overflow: hidden;
      background: #ffffff;
    }

    /* FULL PAGE IMAGE COVER */
    .full-image-cover {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    /* FRONT COVER STYLES */
    .front-cover {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 100%;
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.4) 0%, rgba(15, 23, 42, 0.85) 100%), url('${coverImage || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=1200&q=80'}');
      background-size: cover;
      background-position: center;
      color: #ffffff;
      padding: 24mm 20mm;
      text-align: center;
    }

    .front-cover-header {
      font-family: Georgia, serif;
      letter-spacing: 3px;
      font-size: 14px;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.9);
      border-bottom: 2px solid ${primaryColor};
      padding-bottom: 15px;
      display: inline-block;
      margin: 0 auto;
    }

    .front-cover-title-box {
      margin: auto 0;
    }

    .front-cover-title {
      font-family: Georgia, serif;
      font-size: 44px;
      font-weight: 700;
      line-height: 1.15;
      margin: 0 0 15px 0;
      text-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }

    .front-cover-subtitle {
      font-size: 18px;
      font-weight: 300;
      color: #f1f5f9;
      max-width: 85%;
      margin: 0 auto;
    }

    .front-cover-footer {
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      padding-top: 20px;
    }

    .front-cover-author {
      font-family: Georgia, serif;
      font-size: 18px;
      letter-spacing: 2px;
      font-weight: 600;
      color: #ffffff;
    }

    .front-cover-badge {
      display: inline-block;
      margin-top: 12px;
      background: ${primaryColor};
      color: #ffffff;
      padding: 6px 20px;
      border-radius: 50px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    /* INNER PAGES LAYOUT */
    .inner-page {
      padding: 18mm 16mm 12mm 16mm;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .inner-content-wrapper {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .page-title-main {
      font-family: Georgia, serif;
      font-size: 30px;
      color: #0f172a;
      margin: 0 0 10px 0;
    }

    .section-divider {
      width: 50px;
      height: 4px;
      background: ${primaryColor};
      border-radius: 2px;
      margin-bottom: 16px;
    }

    /* FOOTER AT BOTTOM OF EVERY INNER PAGE */
    .inner-page-footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
      margin-top: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10.5px;
      font-weight: 500;
      color: #64748b;
    }

    .footer-title {
      font-weight: 600;
      color: #334155;
    }

    /* TOC CATEGORY GROUPED STYLES */
    .toc-category-group {
      margin-bottom: 16px;
    }

    .toc-category-header {
      font-family: Georgia, serif;
      font-size: 15px;
      font-weight: 700;
      color: ${primaryColor};
      text-transform: uppercase;
      letter-spacing: 1px;
      padding-bottom: 4px;
      border-bottom: 2px solid ${currentTheme.border};
      margin-bottom: 8px;
    }

    .toc-item {
      padding: 6px 0;
      border-bottom: 1px dashed #e2e8f0;
    }

    .toc-link {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      width: 100%;
      text-decoration: none;
      color: inherit;
    }

    .toc-link:hover .toc-title {
      color: ${primaryColor};
      text-decoration: underline;
    }

    .toc-title {
      font-weight: 600;
      font-size: 13.5px;
      color: #1e293b;
    }

    /* RECIPE PAGE STYLES (STRICT 1-PAGE FIT) */
    .recipe-title-main {
      font-family: Georgia, serif;
      font-size: 24px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 8px 0;
      line-height: 1.2;
    }

    .recipe-meta-bar {
      display: flex;
      gap: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 6px 14px;
      font-size: 11px;
      font-weight: 500;
      color: #475569;
      margin-bottom: 12px;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .meta-item strong {
      color: #0f172a;
    }

    .recipe-content-grid {
      display: grid;
      grid-template-columns: 1fr 1.25fr;
      gap: 16px;
      flex-grow: 1;
      overflow: hidden;
    }

    .recipe-image {
      width: 100%;
      height: 180px;
      object-fit: cover;
      border-radius: 10px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.06);
      margin-bottom: 12px;
    }

    .ingredients-box {
      background: #f8fafc;
      border-left: 3.5px solid ${primaryColor};
      padding: 12px;
      border-radius: 0 8px 8px 0;
    }

    .ingredients-box h3 {
      font-size: 12.5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 8px 0;
      color: #0f172a;
    }

    .ingredients-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .ingredients-list li {
      padding: 4px 0;
      border-bottom: 1px solid #f1f5f9;
      display: flex;
      justify-content: space-between;
      font-size: 11.5px;
    }

    .ingredients-list li:last-child {
      border-bottom: none;
    }

    .ingredient-amount {
      font-weight: 600;
      color: ${primaryColor};
    }

    .steps-box h3 {
      font-size: 12.5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 8px 0;
      color: #0f172a;
    }

    .steps-list {
      padding-left: 18px;
      margin: 0;
    }

    .steps-list li {
      margin-bottom: 8px;
      font-size: 11.5px;
      color: #334155;
      line-height: 1.45;
    }

    .chef-tip-box {
      margin-top: 10px;
      background: ${currentTheme.lightBg};
      border: 1px solid ${currentTheme.border};
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 11px;
      color: ${currentTheme.text};
      line-height: 1.4;
    }

    /* BACK COVER STYLES */
    .back-cover {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      height: 100%;
      background: #0f172a;
      color: #ffffff;
      padding: 24mm 20mm;
    }

    .back-cover-header {
      font-family: Georgia, serif;
      font-size: 24px;
      color: ${primaryColor};
      border-bottom: 2px solid rgba(255,255,255,0.1);
      padding-bottom: 15px;
    }

    .back-cover-blurb {
      font-size: 15px;
      line-height: 1.7;
      color: #cbd5e1;
      margin: 20px 0;
    }

    .author-bio-box {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      padding: 18px;
      border-radius: 12px;
      margin-top: 20px;
    }

    .author-bio-title {
      font-family: Georgia, serif;
      font-size: 16px;
      color: #ffffff;
      margin: 0 0 8px 0;
    }

    .author-bio-text {
      font-size: 12.5px;
      color: #94a3b8;
      margin: 0;
    }

    .back-cover-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid rgba(255,255,255,0.1);
      padding-top: 20px;
      font-size: 11.5px;
      color: #64748b;
    }

    .social-links {
      display: flex;
      gap: 15px;
    }

    .social-links a {
      color: ${primaryColor};
      text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body>

  <!-- FRONT COVER -->
  <div class="page">
    ${
      useCustomFrontCover && coverImage
        ? `<img src="${coverImage}" class="full-image-cover" alt="Front Cover" />`
        : `
      <div class="front-cover">
        <div class="front-cover-header">${labels.brand}</div>
        <div class="front-cover-title-box">
          <h1 class="front-cover-title">${title}</h1>
          ${subtitle ? `<div class="front-cover-subtitle">${subtitle}</div>` : ''}
          <div class="front-cover-badge">${labels.badge}</div>
        </div>
        <div class="front-cover-footer">
          <div class="front-cover-author">${labels.by} ${author || labels.defaultAuthor}</div>
        </div>
      </div>
    `
    }
  </div>

  <!-- INTRODUCTION -->
  <div class="page inner-page">
    <div class="inner-content-wrapper">
      <h2 class="page-title-main">${introTitle || (isEn ? 'Welcome to Your Cookbook' : 'Bienvenue dans votre Livre de Recettes')}</h2>
      <div class="section-divider"></div>
      <div style="font-size: 14px; line-height: 1.8; color: #334155; white-space: pre-line;">
        ${introText || (isEn
          ? `Dear Food Lovers,\n\nWelcome to this curated cookbook designed to bring delicious, wholesome, and easy-to-make recipes directly to your kitchen.\n\nWhether you are looking for quick weeknight dinner ideas or entertaining guests, each recipe offers clear step-by-step instructions and chef secrets. Enjoy your cooking journey!`
          : `Chers gourmands et passionnés de cuisine,\n\nBienvenue dans cet ouvrage culinaire spécialement conçu pour éveiller vos papilles...\n\nBon appétit !`)}
      </div>
    </div>

    <!-- FOOTER AT BOTTOM -->
    <div class="inner-page-footer">
      <span class="footer-title">${title}</span>
      <span>${labels.page} 2</span>
    </div>
  </div>

  <!-- TABLE OF CONTENTS (GROUPED BY CATEGORY WITH CLICKABLE ANCHORS) -->
  <div class="page inner-page" id="table-of-contents">
    <div class="inner-content-wrapper">
      <h2 class="page-title-main">${labels.toc}</h2>
      <div class="section-divider"></div>
      <div style="margin-top: 5px;">
        ${categoryOrder
          .map((catName) => {
            const catRecipes = categoriesMap[catName];
            return `
              <div class="toc-category-group">
                <div class="toc-category-header">${catName}</div>
                ${catRecipes
                  .map(
                    (recipe) => `
                    <div class="toc-item">
                      <a href="#recipe-${recipe.id}" class="toc-link">
                        <span class="toc-title">${recipe.title}</span>
                        <span style="font-weight: 600; color: #64748b;">${labels.page} ${recipePageNumbers[recipe.id]}</span>
                      </a>
                    </div>
                  `
                  )
                  .join('')}
              </div>
            `;
          })
          .join('')}
      </div>
    </div>

    <!-- FOOTER AT BOTTOM -->
    <div class="inner-page-footer">
      <span class="footer-title">${title}</span>
      <span>${labels.page} 3</span>
    </div>
  </div>

  <!-- RECIPE PAGES (GROUPED CONTINUOUSLY BY CATEGORY) -->
  ${sortedRecipes
    .map(
      (recipe) => `
    <div class="page inner-page" id="recipe-${recipe.id}">
      <div class="inner-content-wrapper">
        <h2 class="recipe-title-main">${recipe.title}</h2>
        <div class="recipe-meta-bar">
          <div class="meta-item">⏱️ ${labels.prep} <strong>${recipe.prepTime}</strong></div>
          <div class="meta-item">🔥 ${labels.cook} <strong>${recipe.cookTime}</strong></div>
          <div class="meta-item">🍽️ ${labels.servings} <strong>${recipe.servings}</strong></div>
        </div>

        <div class="recipe-content-grid">
          <div>
            ${
              recipe.imageUrl
                ? `<img src="${recipe.imageUrl}" class="recipe-image" alt="${recipe.title}" />`
                : ''
            }
            <div class="ingredients-box">
              <h3>${labels.ingredients}</h3>
              <ul class="ingredients-list">
                ${recipe.ingredients
                  .map(
                    (ing) => `
                  <li>
                    <span>${ing.item}</span>
                    <span class="ingredient-amount">${ing.amount}</span>
                  </li>
                `
                  )
                  .join('')}
              </ul>
            </div>
          </div>

          <div>
            <div class="steps-box">
              <h3>${labels.steps}</h3>
              <ol class="steps-list">
                ${recipe.steps
                  .map(
                    (step) => `
                  <li>${step}</li>
                `
                  )
                  .join('')}
              </ol>
            </div>

            ${
              recipe.tips
                ? `
              <div class="chef-tip-box">
                💡 <strong>${labels.chefTip}</strong> ${recipe.tips}
              </div>
            `
                : ''
            }
          </div>
        </div>
      </div>

      <!-- FOOTER AT BOTTOM OF RECIPE PAGE -->
      <div class="inner-page-footer">
        <span class="footer-title">${title}</span>
        <span>${labels.page} ${recipePageNumbers[recipe.id]}</span>
      </div>
    </div>
  `
    )
    .join('')}

  <!-- BACK COVER -->
  <div class="page">
    ${
      useCustomBackCover && backCoverImage
        ? `<img src="${backCoverImage}" class="full-image-cover" alt="Back Cover" />`
        : `
      <div class="back-cover">
        <div>
          <div class="back-cover-header">${title}</div>
          <div class="back-cover-blurb">
            ${backCoverText || (isEn
              ? `Discover an exclusive collection of mouthwatering recipes crafted to elevate your daily meals. Simple ingredients, crystal-clear instructions, and pro chef secrets for guaranteed success.`
              : `Découvrez une sélection exclusive de recettes gourmandes créées pour sublimer vos repas...`)}
          </div>
          <div class="author-bio-box">
            <div class="author-bio-title">${labels.aboutAuthor}</div>
            <div class="author-bio-text">
              ${backCoverAuthorBio || (isEn
                ? `${author || labels.defaultAuthor} is a passionate culinary artist and cookbook author dedicated to making gourmet cooking accessible to everyone.`
                : `${author || labels.defaultAuthor} est passionné de gastronomie...`)}
            </div>
          </div>
        </div>

        <div class="back-cover-footer">
          <div>© ${new Date().getFullYear()} ${brandName || author}. ${labels.rights}</div>
          <div class="social-links">
            ${socialLinks?.website ? `<a href="${socialLinks.website}">${socialLinks.website}</a>` : ''}
            ${socialLinks?.instagram ? `<span>${socialLinks.instagram}</span>` : ''}
          </div>
        </div>
      </div>
    `
    }
  </div>

</body>
</html>
`;
}
