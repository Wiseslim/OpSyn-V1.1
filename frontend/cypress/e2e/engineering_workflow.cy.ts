describe('Engineering workflow', () => {
  it('walks the design -> BOQ -> deployment flow', () => {
    cy.visit('/engineering');
    cy.contains('Engineering').should('be.visible');

    cy.contains('Projects').click();
    cy.contains('Create Project').should('be.visible');

    cy.visit('/engineering/project/designs');
    cy.contains('Designs').should('be.visible');

    cy.visit('/engineering/project/boq');
    cy.contains('BOQ').should('be.visible');

    cy.visit('/engineering/project/deployed');
    cy.contains('Deployment').should('be.visible');
  });
});
