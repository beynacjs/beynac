import { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
// @ts-ignore
import Layout from "./Layout.vue";

export default {
  extends: DefaultTheme,
  Layout,
} satisfies Theme;
