export const migrationSteps = [
    { id: 1, title: "Customer Info" },
    { id: 2, title: "Xero Connection" },
    { id: 3, title: "Reckon Connection" },
    { id: 4, title: "Migration" },
    { id: 5, title: "Completed" },
  ];
  
  export const getCurrentStep = (pathname: string): number => {
    if (pathname.includes("/customer-info")) return 1;
    if (pathname.includes("/xero-file-selection")) return 2;
    if (pathname.includes("/connect-accounts")) {
      // Xero + Reckon are on the same page:
      // - when Xero just connected (coming from Xero flow) we show step 2
      // - when Reckon just connected (coming from Reckon flow) we show step 3
      const params = new URLSearchParams(window.location.search);
      if (params.get("reckon_connected") === "true") return 3;
      return 2;
    }
    if (pathname.includes("/Reckon-file-selection")) return 3;
    if (pathname.includes("/migration-progress")) return 4;
    if (pathname.includes("/completed")) return 5; // optional final summary route
    return 1;
  };