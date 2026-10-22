import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as fs from 'fs';

test.describe.configure({ mode: 'serial' });

test.describe('PocketPilot Full End-to-End & Accessibility Suite', () => {
  test.setTimeout(180_000);

  test('1. Complete user journey: Demo sign-in, Transactions CRUD, Search/Filter/Sort/CSV, Budgets, Goals, Payments, Affordability, Sample Data, Reset, Viewports & Axe Accessibility', async ({
    page,
  }) => {
    // -------------------------------------------------------------------------
    // A. LOGIN PAGE ACCESSIBILITY & DEMO SIGN-IN
    // -------------------------------------------------------------------------
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'PocketPilot' })).toBeVisible();

    const loginAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(loginAxe.violations).toEqual([]);

    // Click "Try demo"
    await page.getByRole('button', { name: /Try demo/i }).click();
    await page.waitForURL('**/overview**', { timeout: 45_000 });

    // Confirm sample data banner is visible
    await expect(
      page.getByRole('region', { name: 'Sample data notification' })
    ).toBeVisible({ timeout: 20_000 });

    // Confirm data persists after refresh
    await page.reload();
    await expect(page.getByTestId('card-available-balance')).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Sample data notification' })
    ).toBeVisible();

    // Verify notification bell badge shows overdue + due soon payments (2 active)
    await expect(page.getByTestId('bell-badge-count')).toHaveText('2');

    // -------------------------------------------------------------------------
    // B. ADD EXPENSE & CONFIRM OVERVIEW CARDS, CHART, BUDGET BAR & ANALYTICS UPDATE
    // -------------------------------------------------------------------------
    await page.goto('/transactions');
    await expect(
      page.getByRole('heading', { name: 'Transactions Ledger' })
    ).toBeVisible();

    await page.getByRole('button', { name: 'Add transaction' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByLabel('Amount (INR)').fill('1500');
    await dialog.getByLabel('Description').fill('E2E Test Dinner');
    await dialog.getByLabel('Category').selectOption('food_dining');
    await dialog.getByRole('button', { name: 'Save transaction' }).click();

    await expect(dialog).toBeHidden({ timeout: 15_000 });
    await expect(page.getByText('E2E Test Dinner').first()).toBeVisible();

    // Check Budget bar updated on /budgets (Food & Dining was ₹8,600 / ₹10,000 = 86%, now ₹10,100 = 101% Exceeded!)
    await page.goto('/budgets');
    const foodBudgetCard = page.getByTestId('budget-card-food_dining');
    await expect(foodBudgetCard).toBeVisible();
    await expect(foodBudgetCard).toContainText('Exceeded (101.0%)');
    await expect(foodBudgetCard).toContainText('₹10,100');

    // Check Overview card & chart table update
    await page.goto('/overview');
    await expect(page.getByTestId('card-period-expenses')).toBeVisible();
    await page.getByRole('button', { name: 'View as table' }).first().click();
    await expect(
      page.getByRole('table', { name: 'Income vs Expenses table' })
    ).toBeVisible();

    // Check Analytics page updates
    await page.goto('/analytics');
    await expect(
      page.getByRole('heading', { name: /Financial Analytics/i })
    ).toBeVisible();
    await expect(page.getByText('Food and Dining').first()).toBeVisible();

    // -------------------------------------------------------------------------
    // C. EDIT TRANSACTION AMOUNT & DELETE TRANSACTION
    // -------------------------------------------------------------------------
    await page.goto('/transactions');
    await page.getByRole('button', { name: 'Edit E2E Test Dinner' }).click();
    const editDialog = page.getByRole('dialog');
    await expect(editDialog).toBeVisible();
    await editDialog.getByLabel('Amount (INR)').fill('2000');
    await editDialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(editDialog).toBeHidden({ timeout: 15_000 });
    await expect(page.getByText('-₹2,000').first()).toBeVisible();

    // Delete E2E Test Dinner
    await page.getByRole('button', { name: 'Delete E2E Test Dinner' }).click();
    const deleteDialog = page.getByRole('dialog');
    await deleteDialog.getByRole('button', { name: 'Delete transaction' }).click();
    await expect(deleteDialog).toBeHidden({ timeout: 15_000 });
    await expect(page.getByText('E2E Test Dinner')).toHaveCount(0);

    // -------------------------------------------------------------------------
    // D. SEARCH, FILTER, SORT & CSV DOWNLOAD CONTENTS
    // -------------------------------------------------------------------------
    await page.getByLabel('Search description').fill('Ergonomic');
    await expect(
      page.getByText('Ergonomic Mechanical Keyboard & Stand').first()
    ).toBeVisible();

    // Clear filters
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page.getByLabel('Search description')).toHaveValue('');

    // Filter by Income only and Sort by Amount
    await page.getByLabel('Type').selectOption('income');
    await page.getByRole('button', { name: /Amount/i }).click();

    // Trigger CSV export and verify file contents
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const download = await downloadPromise;
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    if (downloadPath) {
      const csvText = fs.readFileSync(downloadPath, 'utf-8');
      expect(csvText.charCodeAt(0)).toBe(0xfeff); // UTF-8 BOM
      expect(csvText).toContain('Date,Type,Category,Description,Amount,Notes');
      expect(csvText).toContain('Monthly Salary Credit');
    }

    await page.getByRole('button', { name: 'Clear filters' }).click();

    // -------------------------------------------------------------------------
    // E. SAVINGS GOALS: CREATE, CONTRIBUTE, WITHDRAW, REJECT OVER-CONTRIBUTION
    // -------------------------------------------------------------------------
    await page.goto('/goals');
    await page.getByRole('button', { name: 'New goal' }).click();
    const goalDialog = page.getByRole('dialog');
    await goalDialog.getByLabel('Goal name').fill('E2E Camera Goal');
    await goalDialog.getByLabel('Target amount (INR)').fill('50000');
    await goalDialog.getByRole('button', { name: 'Create goal' }).click();
    await expect(goalDialog).toBeHidden({ timeout: 15_000 });

    const cameraCard = page.locator('[data-testid^="goal-card-"]', {
      hasText: 'E2E Camera Goal',
    });
    await expect(cameraCard).toBeVisible();

    // Contribute ₹5,000
    await cameraCard.getByRole('button', { name: 'Contribute' }).click();
    const contribDialog = page.getByRole('dialog');
    await contribDialog.getByLabel('Amount (INR)').fill('5000');
    await contribDialog.getByRole('button', { name: 'Confirm contribution' }).click();
    await expect(contribDialog).toBeHidden({ timeout: 15_000 });
    await expect(cameraCard).toContainText('₹5,000');

    // Withdraw ₹2,000 -> Saved becomes ₹3,000
    await cameraCard.getByRole('button', { name: 'Withdraw' }).click();
    const withdrawDialog = page.getByRole('dialog');
    await withdrawDialog.getByLabel('Amount (INR)').fill('2000');
    await withdrawDialog.getByRole('button', { name: 'Confirm withdrawal' }).click();
    await expect(withdrawDialog).toBeHidden({ timeout: 15_000 });
    await expect(cameraCard).toContainText('₹3,000');

    // Attempt over-contribution exceeding Available to spend -> Rejected!
    await cameraCard.getByRole('button', { name: 'Contribute' }).click();
    const overDialog = page.getByRole('dialog');
    await overDialog.getByLabel('Amount (INR)').fill('99000000');
    await overDialog.getByRole('button', { name: 'Confirm contribution' }).click();
    await expect(
      overDialog.getByText(/Contribution exceeds your Available to spend balance/i)
    ).toBeVisible();
    await overDialog.getByRole('button', { name: 'Cancel' }).click();

    // -------------------------------------------------------------------------
    // F. UPCOMING PAYMENTS: MARK PAID -> VERIFY LINKED TXN -> UNDO
    // -------------------------------------------------------------------------
    await page.goto('/payments');
    await page.getByRole('tab', { name: /Overdue/i }).click();
    await expect(page.getByText('ACT Fibernet Broadband')).toBeVisible();

    await page.getByRole('button', { name: 'Mark paid' }).first().click();
    const markDialog = page.getByRole('dialog');
    await markDialog.getByRole('button', { name: 'Confirm & record expense' }).click();
    await expect(markDialog).toBeHidden({ timeout: 15_000 });

    // Switch to Paid tab and verify the linked transaction appears
    await page.getByRole('tab', { name: /Paid/i }).click();
    await expect(page.getByText('ACT Fibernet Broadband').first()).toBeVisible();

    // Undo the payment and verify it is removed from Paid tab
    await page.getByRole('button', { name: 'Undo' }).first().click();
    await expect(page.getByText('No paid bill records yet')).toBeVisible({
      timeout: 15_000,
    });

    // -------------------------------------------------------------------------
    // G. AFFORDABILITY CALCULATOR (ALL 3 OUTCOMES)
    // -------------------------------------------------------------------------
    await page.goto('/affordability');
    await page.getByLabel('Available balance').fill('50000');
    await page.getByLabel('Purchase amount').fill('15000');
    await page.getByLabel('Minimum reserve').fill('20000');
    await expect(page.getByTestId('affordability-outcome-badge')).toContainText(
      'Comfortable'
    );

    await page.getByLabel('Purchase amount').fill('35000');
    await expect(page.getByTestId('affordability-outcome-badge')).toContainText(
      'Dips into reserve'
    );
    await expect(page.getByTestId('affordability-shortfall')).toContainText('₹5,000');

    await page.getByLabel('Purchase amount').fill('60000');
    await expect(page.getByTestId('affordability-outcome-badge')).toContainText(
      'Exceeds balance'
    );
    await expect(page.getByTestId('affordability-shortfall')).toContainText('₹10,000');

    // -------------------------------------------------------------------------
    // H. VIEWPORTS (375, 768, 1280) & AUTOMATED ACCESSIBILITY ON EVERY PAGE
    // -------------------------------------------------------------------------
    const routes = [
      '/overview',
      '/transactions',
      '/budgets',
      '/goals',
      '/analytics',
      '/payments',
      '/affordability',
      '/settings',
    ];

    for (const route of routes) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(route);

      const axeRes = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze();
      expect(
        axeRes.violations,
        `Accessibility violations on ${route}`
      ).toEqual([]);

      for (const vp of [
        { width: 1280, height: 800 },
        { width: 768, height: 1024 },
        { width: 375, height: 812 },
      ]) {
        await page.setViewportSize(vp);
        const hasHorizontalScroll = await page.evaluate(
          () =>
            document.documentElement.scrollWidth >
            document.documentElement.clientWidth
        );
        expect(
          hasHorizontalScroll,
          `Horizontal overflow on ${route} at ${vp.width}px`
        ).toBe(false);
      }
    }

    // -------------------------------------------------------------------------
    // I. CLEAR & RELOAD SAMPLE DATA, THEN RESET ALL DATA
    // -------------------------------------------------------------------------
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/settings');

    // Clear sample data via banner
    await page
      .getByRole('region', { name: 'Sample data notification' })
      .getByRole('button', { name: 'Clear sample data' })
      .click();
    await expect(
      page.getByRole('region', { name: 'Sample data notification' })
    ).toBeHidden({ timeout: 20_000 });

    // Reload sample data via Settings button
    await page.getByRole('button', { name: 'Load sample data' }).click();
    await expect(
      page.getByRole('region', { name: 'Sample data notification' })
    ).toBeVisible({ timeout: 20_000 });

    // Reset all data: button disabled until typing RESET
    const resetBtn = page.getByRole('button', { name: 'Reset all data' });
    await expect(resetBtn).toBeDisabled();
    await page.getByLabel('Type RESET to confirm').fill('RESET');
    await expect(resetBtn).toBeEnabled();
    await resetBtn.click();

    await expect(
      page.getByRole('region', { name: 'Sample data notification' })
    ).toBeHidden({ timeout: 20_000 });

    await page.goto('/overview');
    await expect(page.getByTestId('available-to-spend-value')).toHaveText('₹0');
  });
});
