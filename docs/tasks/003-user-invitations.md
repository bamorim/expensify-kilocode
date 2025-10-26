# Task: Implement User Invitation system for organizations

## Meta Information

- **Task ID**: TASK-003
- **Title**: Implement User Invitation system for organizations
- **Status**: Not Started
- **Priority**: P0
- **Created**: 2025-10-26
- **Updated**: 2025-10-26
- **Estimated Effort**: 2 days
- **Actual Effort**: [Hours/Days]

## Related Documents

- **PRD**: [docs/product/prd-main.md](../product/prd-main.md) (FR1: User Management)
- **ADR**: [docs/technical/decisions/0001-use-t3-stack.md](../technical/decisions/0001-use-t3-stack.md)
- **Dependencies**: TASK-001 (Organization Management), TASK-002 (User Management)

## Description

Implement a user invitation system that allows organization admins to invite users via email. This includes creating invitation records, sending invitation emails, handling invitation acceptance, and managing invitation expiration.

## Acceptance Criteria

- [ ] Invitation model created with proper fields and expiration
- [ ] Email service integration for sending invitations
- [ ] tRPC procedures for creating and managing invitations
- [ ] Invitation acceptance flow for new users
- [ ] Invitation acceptance flow for existing users
- [ ] UI for inviting users and managing pending invitations
- [ ] Proper error handling for expired/invalid invitations
- [ ] Tests for all invitation workflows

## TODOs

### Database Schema
- [ ] Create Invitation model with required fields
- [ ] Add proper indexes for invitation lookups
- [ ] Create database migration
- [ ] Add constraints for unique email-organization combinations

### Email Service Setup
- [ ] Configure email service (using existing nodemailer)
- [ ] Create email templates for invitations
- [ ] Set up email sending utilities
- [ ] Handle email delivery errors gracefully

### API Implementation
- [ ] Create invitation tRPC router
- [ ] Implement createInvitation procedure
- [ ] Implement getPendingInvitations procedure
- [ ] Implement acceptInvitation procedure
- [ ] Implement revokeInvitation procedure
- [ ] Add proper input validation and error handling

### Invitation Flow
- [ ] Create invitation acceptance page/route
- [ ] Handle invitation acceptance for new users (signup + join)
- [ ] Handle invitation acceptance for existing users (join only)
- [ ] Implement invitation expiration logic
- [ ] Add invitation status tracking

### UI Components
- [ ] Create invitation form component
- [ ] Create pending invitations list
- [ ] Create invitation acceptance page
- [ ] Add invitation management to organization settings
- [ ] Implement proper error states and loading indicators

### Testing
- [ ] Write unit tests for invitation procedures
- [ ] Write integration tests for invitation workflows
- [ ] Test invitation expiration handling
- [ ] Test email sending (mocked in tests)

## Progress Updates

### 2025-10-26 - Architect
**Status**: Not Started
**Progress**: Task created based on PRD requirements
**Blockers**: Depends on TASK-001 and TASK-002 completion
**Next Steps**: Wait for Organization and User Management implementation

## Completion Checklist

- [ ] All acceptance criteria met
- [ ] Code follows project standards
- [ ] Tests written and passing
- [ ] Documentation updated (if needed)
- [ ] Code review completed

## Notes

This feature enables organic growth within organizations by allowing admins to invite team members. The invitation system needs to handle both new user signup and existing user joining scenarios.

Key considerations:
- Invitations should have expiration dates
- Email delivery needs proper error handling
- Invitation links should be secure and single-use
- Need to handle users invited to multiple organizations
- Consider re-sending invitations for expired ones
- Admins should be able to revoke pending invitations