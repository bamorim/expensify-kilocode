/*
  Warnings:

  - You are about to drop the `Expense` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Expense" DROP CONSTRAINT "Expense_organizationId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Expense" DROP CONSTRAINT "Expense_submittedBy_fkey";

-- DropTable
DROP TABLE "public"."Expense";

-- DropEnum
DROP TYPE "public"."ExpenseStatus";
