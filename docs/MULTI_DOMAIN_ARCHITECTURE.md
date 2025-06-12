# Multi-Domain Storefront Architecture

## Table of Contents
1. [Overview](#overview)
2. [Core Components](#core-components)
3. [Implementation Details](#implementation-details)
4. [Partner Onboarding](#partner-onboarding)
5. [Development Guidelines](#development-guidelines)
6. [Deployment](#deployment)
7. [Monitoring & Analytics](#monitoring--analytics)
8. [Troubleshooting](#troubleshooting)

## Overview

The multi-domain storefront system allows partners to showcase their stores through either:
- Subdirectory: `store.fun/partner-slug`
- Custom domain: `store.partner.com`

While maintaining a centralized merchant dashboard at `store.fun/dashboard`.

### Key Features
- Centralized authentication through store.fun
- Partner-specific theming
- SEO optimization for both access methods
- Automated SSL handling
- Analytics tracking per store

## Core Components

### Database Schema

```sql
CREATE TABLE partner_stores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT NOT NULL UNIQUE,      -- For store.fun/partner-slug
    domain TEXT UNIQUE,             -- Optional custom domain
    name TEXT NOT NULL,             -- Store display name
    theme_settings JSONB,           -- Store-specific theme configuration
    is_custom_domain_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX partner_stores_slug_idx ON partner_stores(slug);
CREATE INDEX partner_stores_domain_idx ON partner_stores(domain);
```

### Key Files

```
src/
├── utils/
│   └── store-resolver.ts    # Store context resolution
├── components/
│   └── StorefrontLayout.tsx # Base layout with store context
└── router.tsx              # Main routing configuration

netlify/
└── edge-functions/
    └── custom-domains.ts    # Custom domain handling
```

## Implementation Details

### Store Resolution Logic

```typescript
// src/utils/store-resolver.ts
export const resolveStore = async (req: Request): Promise<StoreConfig | null> => {
  const url = new URL(req.url);
  const hostname = url.hostname;
  const path = url.pathname;

  // Check custom domain
  if (hostname !== 'store.fun') {
    return await getStoreByDomain(hostname);
  }

  // Check subdirectory
  const matches = path.match(/^\/([^\/]+)/);
  if (matches) {
    return await getStoreBySlug(matches[1]);
  }

  return null;
};
```

### Edge Function Handler

```typescript
// netlify/edge-functions/custom-domains.ts
export default async function handler(req: Request, context: Context) {
  // Skip for main domain
  if (context.hostname === 'store.fun') {
    return context.next();
  }

  const store = await resolveStore(req);
  if (!store) {
    return new Response('Store not found', { status: 404 });
  }

  context.store = store;
  return context.next();
}
```

### SEO Implementation

```typescript
// src/components/StorefrontLayout.tsx
export function StorefrontLayout() {
  const store = useLoaderData<StoreConfig>();
  const location = useLocation();
  const isCustomDomain = window.location.hostname !== 'store.fun';
  const baseUrl = isCustomDomain 
    ? `https://${window.location.hostname}`
    : `https://store.fun/${store.slug}`;

  return (
    <Helmet>
      <title>{store.name}</title>
      <link rel="canonical" href={`${baseUrl}${location.pathname}`} />
      {isCustomDomain ? (
        <link 
          rel="alternate" 
          href={`https://store.fun/${store.slug}${location.pathname}`} 
        />
      ) : store.domain && (
        <link 
          rel="alternate" 
          href={`https://${store.domain}${location.pathname}`} 
        />
      )}
    </Helmet>
  );
}
```

## Partner Onboarding

### Process Flow

1. **Initial Setup**
   - Create partner_stores entry
   - Assign unique slug
   - Configure basic theme

2. **Custom Domain (Optional)**
   - Partner adds CNAME record to store.fun
   - Admin verifies DNS
   - Enable custom domain flag

3. **Store Configuration**
   - Complete theme setup
   - Configure products
   - Test both access methods

### DNS Configuration

Partners must add this CNAME record:
```
Host: store
Points to: store.fun
TTL: 3600 (or Auto)
```

## Development Guidelines

### Adding New Features

Consider these aspects:
1. **Access Context**
   - Should it work on custom domains?
   - Is it dashboard-only?
   - Are there cross-domain implications?

2. **Testing Requirements**
   - Test on store.fun
   - Test on store.fun/partner
   - Test on store.partner.com

3. **Security Considerations**
   - Verify store context
   - Check CORS implications
   - Maintain auth at store.fun

### Required Environment Variables

```env
SITE_URL=https://store.fun
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

## Deployment

### SSL Certificates
- Automatic provisioning through Netlify
- Verify before domain activation
- Monitor renewal status

### Performance Optimization
- CDN caching per domain
- Store config caching
- Static asset optimization

## Monitoring & Analytics

### Per-Store Tracking
- Pageviews
- Conversion rates
- Traffic sources
- Custom domain vs subdirectory stats

### Error Tracking
- Store context in logs
- Separate custom domain monitoring
- Central error dashboard

## Troubleshooting

### Common Issues

1. **Custom Domain Not Working**
   - Check DNS propagation
   - Verify CNAME record
   - Check SSL status
   - Verify active flag

2. **Store Not Found**
   - Verify store slug
   - Check domain config
   - Review edge function logs

3. **Cross-Origin Issues**
   - Check CORS headers
   - Verify auth tokens
   - Review API endpoints

### Support Contacts

- Technical: tech@store.fun
- Partner Support: partners@store.fun

## Future Considerations

### Scalability
- Implement store config caching
- Plan for database partitioning
- Consider CDN expansion

### Planned Features
- Automated SSL setup
- Partner payment processing
- Advanced theme system
- Multi-language support

## Maintenance Tasks

### Regular Checks
- SSL certificate status
- DNS configuration
- Database optimization
- Performance metrics
- Security audits

### Backup Strategy
- Daily database backups
- Store configurations
- Theme settings

## Version History

| Date       | Version | Changes                          |
|------------|---------|----------------------------------|
| 2024-03-XX | 1.0     | Initial multi-domain implementation |

## Additional Resources

- [Netlify Custom Domains](https://docs.netlify.com/domains-https/custom-domains/)
- [Supabase Multi-Tenant Guide](https://supabase.com/docs/guides/platform/multi-tenancy)
- [React Router Documentation](https://reactrouter.com/docs/en/v6)

---

Last Updated: March 2024 