# SCSS Structure Documentation

This project uses SCSS for styling, which is organized using the 7-1 pattern (simplified).

## Directory Structure

```
scss/
│
├── abstracts/             # Variables, mixins, functions
│   ├── _variables.scss    # Color, typography, spacing variables
│   └── _mixins.scss       # Reusable mixins and functions
│
├── base/                  # Base styles
│   └── _reset.scss        # Reset and base element styles
│
├── components/            # Reusable components
│   ├── _buttons.scss      # Button styles
│   ├── _cards.scss        # Card components 
│   ├── _chat.scss         # Chat interface components
│   └── _forms.scss        # Form components
│
├── layout/                # Major layout components
│   ├── _header.scss       # Header styles
│   └── _footer.scss       # Footer styles
│
├── pages/                 # Page-specific styles
│   └── _home.scss         # Home page styles
│
└── main.scss              # Main file that imports all partials
```

## Usage

### Compilation

Run these commands to compile SCSS to CSS:

```bash
# One-time compilation
npm run sass

# Watch for changes and compile automatically
npm run sass:watch
```

### Variables

Key variables are defined in `abstracts/_variables.scss` including:

- Color palette
- Typography settings
- Spacing values
- Breakpoints

### Mixins

Common patterns are extracted as mixins in `abstracts/_mixins.scss`:

- `flex()` - Flexbox helper
- `respond-to()` - Media query helper
- `box-shadow()` - Shadow styles
- `transition()` - CSS transitions
- `button()` - Button styles
- `card()` - Card component styles

### Responsive Design

The project uses these breakpoints:

- `sm`: 576px
- `md`: 768px
- `lg`: 992px
- `xl`: 1200px

Use them with the `respond-to` mixin:

```scss
@include respond-to('md') {
  // Styles for medium screens and below
}
```

## Best Practices

1. Don't modify the compiled CSS directly - always edit the SCSS files
2. Use variables for consistency instead of hardcoded values
3. Create new partials for new sections or component types
4. Follow the existing naming conventions
5. Import any new partials in main.scss 