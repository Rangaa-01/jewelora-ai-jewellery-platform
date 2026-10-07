"use client";

import { useState } from "react";
import { LoginForm, RegisterForm } from "./auth-forms";
import { Dialog } from "@/components/ui/dialog";
import { Tab, TabList, TabPanel, Tabs } from "@/components/ui/tabs";
import { useUiStore } from "@/lib/stores/ui-store";

/**
 * Global "sign in to continue" dialog. Any component can call
 * `useUiStore.getState().requestSignIn({ message, onSuccess })`; after a successful
 * login or registration the pending action runs and the dialog closes.
 */
export function SignInPromptHost() {
  const prompt = useUiStore((s) => s.authPrompt);
  const close = useUiStore((s) => s.closeAuthPrompt);
  const [tab, setTab] = useState("login");

  const succeed = () => {
    const action = prompt?.onSuccess;
    close();
    action?.();
  };

  return (
    <Dialog
      open={!!prompt}
      onClose={close}
      title="Sign in to continue"
      description={prompt?.message}
      size="sm"
    >
      <Tabs defaultValue="login" value={tab} onValueChange={setTab}>
        <TabList label="Sign in or create an account">
          <Tab value="login">Sign in</Tab>
          <Tab value="register">Create account</Tab>
        </TabList>
        <TabPanel value="login">
          <LoginForm onSuccess={succeed} />
        </TabPanel>
        <TabPanel value="register">
          <RegisterForm onSuccess={succeed} />
        </TabPanel>
      </Tabs>
    </Dialog>
  );
}
