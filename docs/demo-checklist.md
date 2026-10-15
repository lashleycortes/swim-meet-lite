# Live demo checklist

1. `docker compose ps` and open `http://localhost:8080`.
2. Add a swimmer and create a meet.
3. Push a small visible UI change to GitHub.
4. Show Jenkins starts automatically without Build Now.
5. Show Checkout, Test, Build Images, Deploy, and Smoke Test.
6. Refresh the browser and show the new build tag.
7. Make a unit test fail and push it; show the Test stage fails before Deploy.
8. Revert the failing test and show a successful pipeline.
9. Create a swimmer, redeploy or restart Compose without `-v`, and show the record remains.
10. Set `TAG` to a previous successful build and run `docker compose up -d --no-build`.
11. Explain why Docker socket mounting is risky outside a classroom.
