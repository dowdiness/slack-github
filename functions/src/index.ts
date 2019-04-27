import * as functions from 'firebase-functions'
import { GraphQLClient } from 'graphql-request'
import { format, subDays } from 'date-fns'
import { IncomingWebhook } from '@slack/webhook'

const dotenv = require('dotenv');
dotenv.config();

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//  response.send("Hello from Firebase!");
// });

exports.scheduledFunction = functions.
  region("asia-northeast1").
  pubsub.
  schedule("every sunday 07:00").
  timeZone("Asia/Tokyo").
  onRun(async (context) => {
    const githubApi = "https://api.github.com/graphql"

    const graphQLClient = new GraphQLClient(githubApi, {
      headers: {
        authorization: `Bearer ${process.env.githubKey}`,
      }
    })

    const query = `
    query SearchMostTop3Star($queryString: String!){
      search(type: REPOSITORY, query: $queryString, first: 3) {
        edges {
          node {
            ... on Repository {
              name
              description
              url
              stargazers {
                totalCount
              }
            }
          }
        }
      }
    }
    `

    const today = format(subDays(new Date(), 7), 'yyyy-MM-dd')

    const variables = {
      queryString: `stars:>1000 created:>=${today}`
    }

    const data:any = await graphQLClient.request(query, variables).catch(e => {
      console.error(e)
    })

    const messages = data.search.edges.map((node:any , index: number) => {
      return {
        text: 
        `今週のGithub人気急上昇${index+1} +${node.node.stargazers.totalCount}⭐
  ${node.node.name}
  ${node.node.description}
  ${node.node.url}
  ${node.node.createdAt}`
      }
    })
  
  const slackWebhook = process.env.slackApiUrl

  if (slackWebhook !== undefined) {
    const webhook = new IncomingWebhook(slackWebhook,{
      icon_emoji: ':bowtie:',
    });
    try {
      // ３件ないとエラーが出る
      await webhook.send(messages[0]);
      await webhook.send(messages[1]);  
      await webhook.send(messages[2]);    
    } catch (err) {
      console.error(err)
    }  
  }
});
