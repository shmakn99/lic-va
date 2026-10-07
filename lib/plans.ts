export const plans = [
  {
    id: "new-jeevan-anand",
    name: "New Jeevan Anand",
    number: "715",
    uin: "512N279V03",
    category: "Protection & savings",
    note: "Explore benefits during the policy term and life cover after maturity.",
  },
  {
    id: "jeevan-utsav-single-premium",
    name: "Jeevan Utsav Single Premium",
    number: "883",
    uin: "512N392V01",
    category: "Whole life & income",
    note: "Understand a single premium, income options and guaranteed additions.",
  },
  {
    id: "digi-term",
    name: "Digi Term",
    number: "876",
    uin: "512N356V02",
    category: "Term protection",
    note: "Learn about life cover, benefit options and premium payment choices.",
  },
] as const;
export type PlanId = (typeof plans)[number]["id"];
export type Language = "en-IN" | "hi-IN";
export type Source = {
  id: string;
  planId: string;
  documentTitle: string;
  pageOrSection: string;
  url: string;
  excerpt?: string;
};
export type Answer = {
  kind: "answer" | "clarification" | "unsupported";
  text: string;
  sourceIds: string[];
};
export type Exchange = { user: string; assistant: string };
