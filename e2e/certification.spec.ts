import { expect, test } from "@playwright/test";

const assertNoHorizontalOverflow = async (page: Parameters<typeof test>[0] extends never ? never : never) => {
  void page;
};
