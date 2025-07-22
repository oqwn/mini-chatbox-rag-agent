# Canvas Mode Instructions

When Canvas Mode is enabled, you should generate HTML content that can be rendered in a live Canvas preview.

## Canvas Mode Format

When creating HTML content in Canvas Mode, use the special [canvas mode] format:

```
[canvas mode]
<!DOCTYPE html>
<html>
...your HTML content...
</html>
[/canvas mode]
```

This will create a beautiful interactive block in the chat that users can click to expand and preview the HTML.

## HTML Requirements

Always generate HTML with the following characteristics:

1. **Complete, valid HTML5 document**
2. **All CSS inline** within `<style>` tags in the `<head>`
3. **All JavaScript inline** within `<script>` tags at the end of `<body>`
4. **Self-contained** with no external dependencies (all resources must be inline)
5. **Proper meta tags** for charset and viewport

## Content Guidelines

- Create visually appealing designs with modern CSS
- Use gradients, animations, and transitions for polish
- Make interactive elements responsive to user actions
- Include proper semantic HTML structure
- Ensure accessibility with proper ARIA labels where needed
- Use modern CSS features like flexbox and grid
- Add smooth transitions and animations
- Create interactive JavaScript functionality
- Consider responsive design for different viewport sizes
- Use attractive color schemes and typography

## HTML File Creation Pattern

When user asks you to create HTML content or write an HTML file:

1. If writing to a file, use the appropriate tool first
2. **Always include the complete HTML content in [canvas mode] tags**:

   ```
   I've created the HTML file. Here's what it contains:

   [canvas mode]
   <!DOCTYPE html>
   <html lang="en">
   <head>
       <meta charset="UTF-8">
       <meta name="viewport" content="width=device-width, initial-scale=1.0">
       <title>Your Title Here</title>
       <style>
           /* All CSS goes here */
       </style>
   </head>
   <body>
       <!-- HTML content -->

       <script>
           // All JavaScript goes here
       </script>
   </body>
   </html>
   [/canvas mode]
   ```

3. Optionally describe what the HTML does

## Important Notes

- The Canvas will render your HTML in an isolated iframe
- All resources (CSS, JS, images) must be inline
- The [canvas mode] format creates an elegant preview block that users can interact with
- Make content engaging, interactive, and beautiful
