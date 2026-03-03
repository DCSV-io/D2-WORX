<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
</script>

<Card.Card>
  <Card.CardHeader>
    <Card.CardTitle class="text-2xl">Sign In</Card.CardTitle>
    <Card.CardDescription>Enter your credentials to access your account.</Card.CardDescription>
  </Card.CardHeader>
  <Card.CardContent>
    <p class="text-muted-foreground text-sm">
      Sign-in form will be wired in Step 7 (Auth integration).
    </p>
  </Card.CardContent>
  <Card.CardFooter class="flex flex-col gap-4">
    <Button class="w-full" disabled>Sign In</Button>
    <p class="text-muted-foreground text-center text-sm">
      Don't have an account?
      <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- route not yet created -->
      <a href="/sign-up" class="text-primary underline-offset-4 hover:underline">Sign up</a>
    </p>
  </Card.CardFooter>
</Card.Card>
